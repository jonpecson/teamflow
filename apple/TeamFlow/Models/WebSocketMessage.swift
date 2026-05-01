import Foundation

// MARK: - Server → Client Messages
// Must match src/ws/messages.rs ServerMsg enum exactly

enum ServerMessage {
    case message(MessagePayload)
    case pong
    case presence(PresencePayload)
    case error(ErrorPayload)
    case channelJoined(ChannelEventPayload)
    case channelLeft(ChannelEventPayload)
    case invited(InvitedPayload)
    case callStarted(CallStartedPayload)
    case callEnded(CallEndedPayload)
    case callParticipantJoined(CallParticipantPayload)
    case callParticipantLeft(CallParticipantPayload)
    case callMuted(CallMediaPayload)
    case callUnmuted(CallMediaPayload)
    case callVideoOn(CallMediaPayload)
    case callVideoOff(CallMediaPayload)
    case callScreenShareOn(CallMediaPayload)
    case callScreenShareOff(CallMediaPayload)
    case callSpeaking(CallSpeakingPayload)
    case callNetworkQuality(CallNetworkQualityPayload)
    case callDeclined(CallMediaPayload)
    case rtcSignal(RtcSignalPayload)
    case unknown(String)
}

struct MessagePayload: Codable {
    let id: String
    let channelId: String
    let userId: String
    let username: String
    let content: String
    let timestamp: String

    enum CodingKeys: String, CodingKey {
        case id
        case channelId = "channel_id"
        case userId = "user_id"
        case username, content, timestamp
    }
}

struct PresencePayload: Codable {
    let userId: String
    let username: String
    let status: String // "online" or "offline"

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username, status
    }
}

struct ErrorPayload: Codable {
    let message: String
}

struct ChannelEventPayload: Codable {
    let channelId: String
    let userId: String
    let username: String

    enum CodingKeys: String, CodingKey {
        case channelId = "channel_id"
        case userId = "user_id"
        case username
    }
}

struct InvitedPayload: Codable {
    let channelId: String
    let channelName: String
    let invitedBy: String

    enum CodingKeys: String, CodingKey {
        case channelId = "channel_id"
        case channelName = "channel_name"
        case invitedBy = "invited_by"
    }
}

struct CallStartedPayload: Codable {
    let meetingId: String
    let channelId: String
    let startedBy: String
    let channelName: String

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case startedBy = "started_by"
        case channelName = "channel_name"
    }
}

struct CallEndedPayload: Codable {
    let meetingId: String
    let channelId: String

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
    }
}

struct CallParticipantPayload: Codable {
    let meetingId: String
    let channelId: String
    let username: String

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case username
    }
}

struct CallMediaPayload: Codable {
    let meetingId: String
    let channelId: String
    let username: String

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case username
    }
}

struct CallSpeakingPayload: Codable {
    let meetingId: String
    let channelId: String
    let username: String
    let speaking: Bool

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case username, speaking
    }
}

struct CallNetworkQualityPayload: Codable {
    let meetingId: String
    let channelId: String
    let username: String
    let quality: Int

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case username, quality
    }
}

struct RtcSignalPayload: Codable {
    let meetingId: String
    let fromUser: String
    let signalType: String
    let data: AnyCodable

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case fromUser = "from_user"
        case signalType = "signal_type"
        case data
    }
}

// Simple wrapper for arbitrary JSON values
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else if let arr = try? container.decode([AnyCodable].self) {
            value = arr.map { $0.value }
        } else if let str = try? container.decode(String.self) {
            value = str
        } else if let num = try? container.decode(Double.self) {
            value = num
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let dict = value as? [String: Any] {
            try container.encode(dict.mapValues { AnyCodable($0) })
        } else if let arr = value as? [Any] {
            try container.encode(arr.map { AnyCodable($0) })
        } else if let str = value as? String {
            try container.encode(str)
        } else if let num = value as? Double {
            try container.encode(num)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else {
            try container.encodeNil()
        }
    }
}

// MARK: - Decoding

extension ServerMessage {
    static func decode(from data: Data) -> ServerMessage {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return .unknown("invalid json")
        }

        let decoder = JSONDecoder()

        switch type {
        case "message":
            guard let p = try? decoder.decode(MessagePayload.self, from: data) else { return .unknown(type) }
            return .message(p)
        case "pong":
            return .pong
        case "presence":
            guard let p = try? decoder.decode(PresencePayload.self, from: data) else { return .unknown(type) }
            return .presence(p)
        case "error":
            guard let p = try? decoder.decode(ErrorPayload.self, from: data) else { return .unknown(type) }
            return .error(p)
        case "channel_joined":
            guard let p = try? decoder.decode(ChannelEventPayload.self, from: data) else { return .unknown(type) }
            return .channelJoined(p)
        case "channel_left":
            guard let p = try? decoder.decode(ChannelEventPayload.self, from: data) else { return .unknown(type) }
            return .channelLeft(p)
        case "invited":
            guard let p = try? decoder.decode(InvitedPayload.self, from: data) else { return .unknown(type) }
            return .invited(p)
        case "call_started":
            guard let p = try? decoder.decode(CallStartedPayload.self, from: data) else { return .unknown(type) }
            return .callStarted(p)
        case "call_ended":
            guard let p = try? decoder.decode(CallEndedPayload.self, from: data) else { return .unknown(type) }
            return .callEnded(p)
        case "call_participant_joined":
            guard let p = try? decoder.decode(CallParticipantPayload.self, from: data) else { return .unknown(type) }
            return .callParticipantJoined(p)
        case "call_participant_left":
            guard let p = try? decoder.decode(CallParticipantPayload.self, from: data) else { return .unknown(type) }
            return .callParticipantLeft(p)
        case "call_muted":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callMuted(p)
        case "call_unmuted":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callUnmuted(p)
        case "call_video_on":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callVideoOn(p)
        case "call_video_off":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callVideoOff(p)
        case "call_screen_share_on":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callScreenShareOn(p)
        case "call_screen_share_off":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callScreenShareOff(p)
        case "call_speaking":
            guard let p = try? decoder.decode(CallSpeakingPayload.self, from: data) else { return .unknown(type) }
            return .callSpeaking(p)
        case "call_network_quality":
            guard let p = try? decoder.decode(CallNetworkQualityPayload.self, from: data) else { return .unknown(type) }
            return .callNetworkQuality(p)
        case "call_declined":
            guard let p = try? decoder.decode(CallMediaPayload.self, from: data) else { return .unknown(type) }
            return .callDeclined(p)
        case "rtc_signal":
            guard let p = try? decoder.decode(RtcSignalPayload.self, from: data) else { return .unknown(type) }
            return .rtcSignal(p)
        default:
            return .unknown(type)
        }
    }
}

// MARK: - Client → Server Messages

enum ClientMessage {
    case ping
    case message(channelId: String, content: String)
    case joinChannel(channelId: String)
    case leaveChannel(channelId: String)
    case callMute(meetingId: String)
    case callUnmute(meetingId: String)
    case callVideoOn(meetingId: String)
    case callVideoOff(meetingId: String)
    case callDecline(meetingId: String)
    case rtcSignal(meetingId: String, targetUser: String, signalType: String, data: Any)

    var jsonData: Data? {
        var dict: [String: Any] = [:]
        switch self {
        case .ping:
            dict["type"] = "ping"
        case .message(let channelId, let content):
            dict["type"] = "message"
            dict["channel_id"] = channelId
            dict["content"] = content
        case .joinChannel(let channelId):
            dict["type"] = "join_channel"
            dict["channel_id"] = channelId
        case .leaveChannel(let channelId):
            dict["type"] = "leave_channel"
            dict["channel_id"] = channelId
        case .callMute(let meetingId):
            dict["type"] = "call_mute"
            dict["meeting_id"] = meetingId
        case .callUnmute(let meetingId):
            dict["type"] = "call_unmute"
            dict["meeting_id"] = meetingId
        case .callVideoOn(let meetingId):
            dict["type"] = "call_video_on"
            dict["meeting_id"] = meetingId
        case .callVideoOff(let meetingId):
            dict["type"] = "call_video_off"
            dict["meeting_id"] = meetingId
        case .callDecline(let meetingId):
            dict["type"] = "call_decline"
            dict["meeting_id"] = meetingId
        case .rtcSignal(let meetingId, let targetUser, let signalType, let data):
            dict["type"] = "rtc_signal"
            dict["meeting_id"] = meetingId
            dict["target_user"] = targetUser
            dict["signal_type"] = signalType
            dict["data"] = data
        }
        return try? JSONSerialization.data(withJSONObject: dict)
    }
}
