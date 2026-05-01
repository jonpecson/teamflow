import Foundation

final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var username: String = ""
    @Published var userId: String = ""

    var token: String? {
        KeychainHelper.load(key: "jwt_token")
    }

    init() {
        if let token = KeychainHelper.load(key: "jwt_token"),
           let user = KeychainHelper.load(key: "username"),
           let uid = KeychainHelper.load(key: "user_id") {
            self.username = user
            self.userId = uid
            self.isAuthenticated = true
        }
    }

    func login(username: String, password: String) async throws {
        let response = try await APIClient.shared.login(username: username, password: password)
        saveAuth(response)
    }

    func register(username: String, password: String, inviteCode: String?) async throws {
        let response = try await APIClient.shared.register(username: username, password: password, inviteCode: inviteCode)
        saveAuth(response)
    }

    func logout() {
        KeychainHelper.delete(key: "jwt_token")
        KeychainHelper.delete(key: "username")
        KeychainHelper.delete(key: "user_id")
        WebSocketService.shared.disconnect()
        DispatchQueue.main.async {
            self.isAuthenticated = false
            self.username = ""
            self.userId = ""
        }
    }

    private func saveAuth(_ response: AuthResponse) {
        KeychainHelper.save(key: "jwt_token", value: response.token)
        KeychainHelper.save(key: "username", value: response.username)
        KeychainHelper.save(key: "user_id", value: response.userId)
        DispatchQueue.main.async {
            self.username = response.username
            self.userId = response.userId
            self.isAuthenticated = true
        }
        // Connect WebSocket
        WebSocketService.shared.connect(token: response.token)
    }
}
