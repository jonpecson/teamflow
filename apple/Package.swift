// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TeamFlow",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .executable(name: "TeamFlow", targets: ["TeamFlow"]),
    ],
    dependencies: [
        .package(url: "https://github.com/livekit/webrtc-xcframework.git", exact: "144.7559.04"),
    ],
    targets: [
        .executableTarget(
            name: "TeamFlow",
            dependencies: [
                .product(name: "LiveKitWebRTC", package: "webrtc-xcframework"),
            ],
            path: "TeamFlow",
            resources: [
                .process("Resources"),
            ]
        ),
    ]
)
