import Foundation

// Use UserDefaults for dev builds (no Keychain prompts).
// For signed release builds, switch to Security.framework Keychain.
enum KeychainHelper {
    private static let defaults = UserDefaults.standard
    private static let prefix = "com.teamflow."

    static func save(key: String, value: String) {
        defaults.set(value, forKey: prefix + key)
    }

    static func load(key: String) -> String? {
        defaults.string(forKey: prefix + key)
    }

    static func delete(key: String) {
        defaults.removeObject(forKey: prefix + key)
    }
}
