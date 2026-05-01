import SwiftUI

struct LoginView: View {
    @StateObject private var vm = AuthViewModel()

    var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.04, blue: 0.12)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Logo
                VStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(colors: [.purple, .purple.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 48, height: 48)
                        .overlay(Text("TF").font(.system(size: 20, weight: .bold)).foregroundColor(.white))

                    Text("TeamFlow")
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundColor(.white)

                    Text("Fast chat for small teams")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.6))
                }

                // Tabs
                HStack(spacing: 0) {
                    tabButton("Sign In", selected: vm.isLogin) { vm.isLogin = true }
                    tabButton("Sign Up", selected: !vm.isLogin) { vm.isLogin = false }
                }
                .background(Color.white.opacity(0.06))
                .clipShape(Capsule())

                // Fields
                VStack(spacing: 14) {
                    styledField("Username", text: $vm.username)
                    styledSecureField("Password", text: $vm.password)

                    if !vm.isLogin {
                        styledField("Invite code (e.g. TF-A3X9K2)", text: $vm.inviteCode)
                    }
                }

                // Submit
                Button {
                    Task { await vm.submit() }
                } label: {
                    Text(vm.isLoading ? "Connecting..." : vm.isLogin ? "Sign In" : "Sign Up")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(LinearGradient(colors: [.purple, Color(red: 0.55, green: 0.36, blue: 0.9)], startPoint: .leading, endPoint: .trailing))
                        .clipShape(Capsule())
                        .shadow(color: .purple.opacity(0.4), radius: 16, y: 4)
                }
                .buttonStyle(.plain)
                .disabled(vm.isLoading)

                if let error = vm.error {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                }

                Text("v0.2.0")
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.3))
            }
            .padding(40)
            .frame(maxWidth: 400)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(Color.white.opacity(0.04))
                    .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.white.opacity(0.08)))
            )
        }
    }

    private func tabButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(selected ? .white : .white.opacity(0.5))
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .background(selected ? Color.purple : Color.clear)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

private func styledField(_ placeholder: String, text: Binding<String>) -> some View {
    TextField(placeholder, text: text)
        .textFieldStyle(.plain)
        .padding(.horizontal, 20)
        .padding(.vertical, 13)
        .background(Color(red: 0.1, green: 0.07, blue: 0.18))
        .overlay(RoundedRectangle(cornerRadius: 25).stroke(Color.white.opacity(0.1)))
        .cornerRadius(25)
        .foregroundColor(.white)
}

private func styledSecureField(_ placeholder: String, text: Binding<String>) -> some View {
    SecureField(placeholder, text: text)
        .textFieldStyle(.plain)
        .padding(.horizontal, 20)
        .padding(.vertical, 13)
        .background(Color(red: 0.1, green: 0.07, blue: 0.18))
        .overlay(RoundedRectangle(cornerRadius: 25).stroke(Color.white.opacity(0.1)))
        .cornerRadius(25)
        .foregroundColor(.white)
}
