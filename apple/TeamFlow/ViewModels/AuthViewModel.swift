import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var username = ""
    @Published var password = ""
    @Published var inviteCode = ""
    @Published var isLogin = true
    @Published var error: String?
    @Published var isLoading = false

    func submit() async {
        guard !username.isEmpty, !password.isEmpty else {
            error = "Username and password required"
            return
        }
        error = nil
        isLoading = true
        do {
            if isLogin {
                try await AuthService.shared.login(username: username, password: password)
            } else {
                try await AuthService.shared.register(username: username, password: password, inviteCode: inviteCode.isEmpty ? nil : inviteCode)
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
