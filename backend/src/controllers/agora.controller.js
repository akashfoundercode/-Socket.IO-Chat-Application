const { RtcTokenBuilder, RtcRole } = require("agora-token");

const generateRtcToken = (req, res) => {
    try {
        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            return res.status(500).json({
                success: false,
                message: "Agora App ID or App Certificate is not configured on server"
            });
        }

        const channelName = req.query?.channelName || req.body?.channelName;
        if (!channelName || !String(channelName).trim()) {
            return res.status(400).json({
                success: false,
                message: "channelName is required"
            });
        }

        const rawUid = req.query?.uid || req.body?.uid;
        const roleParam = req.query?.role || req.body?.role || "publisher";
        const role = roleParam === "subscriber" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

        const expireTimeInSeconds = Number(req.query?.expireTime || req.body?.expireTime || 86400);

        let token;
        let uid = 0;

        if (rawUid && !isNaN(Number(rawUid))) {
            uid = Number(rawUid);
            token = RtcTokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                String(channelName).trim(),
                uid,
                role,
                expireTimeInSeconds,
                expireTimeInSeconds
            );
        } else if (rawUid && typeof rawUid === "string" && rawUid.trim()) {
            token = RtcTokenBuilder.buildTokenWithUserAccount(
                appId,
                appCertificate,
                String(channelName).trim(),
                String(rawUid).trim(),
                role,
                expireTimeInSeconds,
                expireTimeInSeconds
            );
            uid = rawUid;
        } else {
            uid = 0;
            token = RtcTokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                String(channelName).trim(),
                0,
                role,
                expireTimeInSeconds,
                expireTimeInSeconds
            );
        }

        return res.status(200).json({
            success: true,
            appId,
            channelName: String(channelName).trim(),
            uid,
            token,
            expiresIn: expireTimeInSeconds
        });
    } catch (error) {
        console.error("generateRtcToken error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate Agora RTC token",
            error: error.message
        });
    }
};

module.exports = {
    generateRtcToken
};
