import Foundation

struct AuthResponse: Codable {
    let token: String
    let userId: String
    let username: String

    enum CodingKeys: String, CodingKey {
        case token
        case userId = "user_id"
        case username
    }
}

struct User: Codable, Identifiable {
    let id: String
    let username: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, username
        case createdAt = "created_at"
    }
}

struct OnlineUser: Codable, Identifiable {
    let userId: String
    let username: String

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
    }
}
