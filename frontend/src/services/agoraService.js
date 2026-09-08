import AgoraRTC from 'agora-rtc-sdk-ng';

// Set Agora log level
try {
  AgoraRTC.setLogLevel(1);
} catch (e) { }

// Global Autoplay Resume Handler
try {
  AgoraRTC.onAutoplayFailed = () => {
    console.warn('[Agora] Autoplay blocked by browser. Resuming on user gesture.');
    const resume = () => {
      try {
        const audioCtx = AgoraRTC.getAudioContext && AgoraRTC.getAudioContext();
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      } catch (e) { }
      window.removeEventListener('click', resume);
      window.removeEventListener('touchstart', resume);
    };
    window.addEventListener('click', resume, { once: true });
    window.addEventListener('touchstart', resume, { once: true });
  };
} catch (e) { }

class AgoraService {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
  }

  initClient() {
    if (!this.client) {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return this.client;
  }

  /**
   * Join an Agora RTC channel and publish local tracks
   */
  async joinChannel({
    appId,
    channelName,
    token,
    uid = 0,
    callType = 'voice',
    onRemoteUserPublished,
    onRemoteUserUnpublished,
    onUserLeft
  }) {
    // Ensure clean state before joining
    await this.leaveChannel();

    const client = this.initClient();

    // Register Remote Event Listeners
    client.on('user-published', async (user, mediaType) => {
      console.log(`[Agora] Remote user ${user.uid} published ${mediaType}`);
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
          console.log(`[Agora] Playing remote audio for user ${user.uid}`);
        }
        if (onRemoteUserPublished) {
          onRemoteUserPublished(user, mediaType);
        }
      } catch (err) {
        console.error('[Agora] Subscribe error:', err);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (onRemoteUserUnpublished) {
        onRemoteUserUnpublished(user, mediaType);
      }
    });

    client.on('user-left', (user, reason) => {
      if (onUserLeft) {
        onUserLeft(user, reason);
      }
    });

    // Join RTC Channel
    const joinedUid = await client.join(
      appId,
      String(channelName).trim(),
      token || null,
      uid || null
    );

    // Create & Publish Local Media Tracks with 3A Noise & Echo Cancellation
    try {
      if (callType === 'video') {
        try {
          [this.localAudioTrack, this.localVideoTrack] =
            await AgoraRTC.createMicrophoneAndCameraTracks(
              { AEC: true, ANS: true, AGC: true },
              { encoderConfig: '720p_1' }
            );
          await client.publish([this.localAudioTrack, this.localVideoTrack]);
          console.log('[Agora] Published local audio and video tracks');
        } catch (videoErr) {
          console.warn('[Agora] Camera access failed, falling back to audio:', videoErr.message);
          try {
            this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              ANS: true,
              AGC: true
            });
            await client.publish([this.localAudioTrack]);
            console.log('[Agora] Published local audio track');
          } catch (audioErr) {
            console.warn('[Agora] Microphone access unavailable:', audioErr.message);
          }
        }
      } else {
        try {
          this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true
          });
          await client.publish([this.localAudioTrack]);
          console.log('[Agora] Published local audio track');
        } catch (audioErr) {
          console.warn('[Agora] Microphone access unavailable:', audioErr.message);
        }
      }
    } catch (mediaErr) {
      console.warn('[Agora] Media track publishing warning:', mediaErr.message);
    }

    return {
      uid: joinedUid,
      localAudioTrack: this.localAudioTrack,
      localVideoTrack: this.localVideoTrack
    };
  }

  /**
   * Toggle Audio Mute / Unmute
   */
  async toggleAudio(isMuted) {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(!isMuted);
    }
  }

  /**
   * Toggle Video Camera On / Off
   */
  async toggleVideo(isVideoDisabled) {
    if (this.localVideoTrack) {
      await this.localVideoTrack.setEnabled(!isVideoDisabled);
    }
  }

  /**
   * Leave channel and cleanup hardware camera/microphone resources
   */
  async leaveChannel() {
    try {
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }
      if (this.client) {
        this.client.removeAllListeners();
        await this.client.leave();
        this.client = null;
      }
    } catch (err) {
      console.warn('[Agora] Cleanup warning:', err.message);
    }
  }
}

export const agoraService = new AgoraService();
export default agoraService;
