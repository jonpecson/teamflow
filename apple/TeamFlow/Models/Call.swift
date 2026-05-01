import Foundation

struct AttendeeInfo: Codable {
    let attendeeId: String
    let joinToken: String

    enum CodingKeys: String, CodingKey {
        case attendeeId = "attendee_id"
        case joinToken = "join_token"
    }
}

struct CallResponse: Codable {
    let meetingId: String
    let channelId: String
    let startedBy: String
    let attendee: AttendeeInfo
    let mediaPlacement: [String: String]

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case startedBy = "started_by"
        case attendee
        case mediaPlacement = "media_placement"
    }
}

struct ActiveCall: Codable, Identifiable {
    let meetingId: String
    let channelId: String
    let channelName: String
    let startedBy: String
    var participants: [String]
    let startedAt: String

    var id: String { meetingId }

    enum CodingKeys: String, CodingKey {
        case meetingId = "meeting_id"
        case channelId = "channel_id"
        case channelName = "channel_name"
        case startedBy = "started_by"
        case participants
        case startedAt = "started_at"
    }
}
