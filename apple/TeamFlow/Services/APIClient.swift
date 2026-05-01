import Foundation

final class APIClient {
    static let shared = APIClient()

    var baseURL = URL(string: "https://teamflow.statlingo.ai/api")!

    private var token: String? {
        KeychainHelper.load(key: "jwt_token")
    }

    private func request<T: Decodable>(_ path: String, method: String = "GET", body: (any Encodable)? = nil) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.network("Invalid response")
        }

        if http.statusCode == 204 || data.isEmpty {
            if let empty = Empty() as? T { return empty }
        }

        guard (200...299).contains(http.statusCode) else {
            if let err = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIError.server(err.error)
            }
            throw APIError.server("Request failed: \(http.statusCode)")
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func requestVoid(_ path: String, method: String = "POST", body: (any Encodable)? = nil) async throws {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            if let err = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIError.server(err.error)
            }
            throw APIError.server("Request failed")
        }
    }

    // MARK: - Auth

    func login(username: String, password: String) async throws -> AuthResponse {
        try await request("/auth/login", method: "POST", body: ["username": username, "password": password])
    }

    func register(username: String, password: String, inviteCode: String? = nil) async throws -> AuthResponse {
        var body: [String: String] = ["username": username, "password": password]
        if let code = inviteCode { body["invite_code"] = code }
        return try await request("/auth/register", method: "POST", body: body)
    }

    // MARK: - Channels

    func listChannels() async throws -> [Channel] {
        try await request("/channels")
    }

    func myChannels() async throws -> [Channel] {
        try await request("/channels/mine")
    }

    func createChannel(name: String) async throws -> Channel {
        try await request("/channels", method: "POST", body: ["name": name])
    }

    func joinChannel(_ id: String) async throws {
        try await requestVoid("/channels/\(id)/join")
    }

    func leaveChannel(_ id: String) async throws {
        try await requestVoid("/channels/\(id)/leave")
    }

    func channelMembers(_ id: String) async throws -> [ChannelMember] {
        try await request("/channels/\(id)/members")
    }

    func channelHistory(_ id: String, limit: Int = 100) async throws -> [Message] {
        try await request("/channels/\(id)/messages?limit=\(limit)")
    }

    func inviteToChannel(_ id: String, userId: String) async throws {
        try await requestVoid("/channels/\(id)/invite", body: ["user_id": userId])
    }

    func getOrCreateDm(userId: String) async throws -> Channel {
        try await request("/dm/\(userId)", method: "POST")
    }

    // MARK: - Users

    func listUsers() async throws -> [User] {
        try await request("/users")
    }

    func onlineUsers() async throws -> [OnlineUser] {
        try await request("/online")
    }

    // MARK: - Calls

    func startCall(channelId: String) async throws -> CallResponse {
        try await request("/calls", method: "POST", body: ["channel_id": channelId])
    }

    func activeCalls() async throws -> [ActiveCall] {
        try await request("/calls/active")
    }

    func joinCall(_ meetingId: String) async throws -> CallResponse {
        try await request("/calls/\(meetingId)/join", method: "POST")
    }

    func leaveCall(_ meetingId: String) async throws {
        try await requestVoid("/calls/\(meetingId)/leave")
    }

    func endCall(_ meetingId: String) async throws {
        try await requestVoid("/calls/\(meetingId)", method: "DELETE")
    }

    // MARK: - Devices (Push)

    func registerDevice(token: String) async throws {
        try await requestVoid("/devices", body: ["token": token, "platform": "apns"])
    }
}

// MARK: - Helpers

enum APIError: LocalizedError {
    case network(String)
    case server(String)

    var errorDescription: String? {
        switch self {
        case .network(let msg): return msg
        case .server(let msg): return msg
        }
    }
}

private struct APIErrorResponse: Codable {
    let error: String
}

private struct Empty: Codable {}

private struct AnyEncodable: Encodable {
    let value: any Encodable
    init(_ value: any Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
