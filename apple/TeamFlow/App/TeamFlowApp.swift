import SwiftUI

@main
struct TeamFlowApp: App {
    @StateObject private var auth = AuthService.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isAuthenticated {
                    MainView()
                        .environmentObject(auth)
                } else {
                    LoginView()
                }
            }
            #if os(macOS)
            .frame(minWidth: 900, minHeight: 600)
            #endif
        }
        #if os(macOS)
        .windowStyle(.titleBar)
        .defaultSize(width: 1200, height: 800)
        #endif
    }
}
