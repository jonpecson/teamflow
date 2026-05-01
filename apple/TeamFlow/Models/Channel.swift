import Foundation

struct Channel: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let createdBy: String?
    let isDm: Bool
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case createdBy = "created_by"
        case isDm = "is_dm"
        case createdAt = "created_at"
    }
}

struct ChannelMember: Codable, Identifiable {
    let userId: String
    let username: String
    let joinedAt: String

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case joinedAt = "joined_at"
    }
}
