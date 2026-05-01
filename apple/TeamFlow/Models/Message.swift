import Foundation

struct Message: Codable, Identifiable, Equatable {
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

    // Also accept "created_at" from history endpoint
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        channelId = try container.decode(String.self, forKey: .channelId)
        userId = try container.decode(String.self, forKey: .userId)
        username = try container.decode(String.self, forKey: .username)
        content = try container.decode(String.self, forKey: .content)
        if let ts = try? container.decode(String.self, forKey: .timestamp) {
            timestamp = ts
        } else {
            timestamp = ""
        }
    }
}
