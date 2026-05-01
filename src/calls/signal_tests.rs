#[cfg(test)]
mod tests {
    use crate::ws::messages::{ClientMsg, ServerMsg};

    #[test]
    fn test_rtc_signal_json_format() {
        // ClientMsg is Deserialize-only; verify the expected JSON format parses correctly
        let json = r#"{"type":"rtc_signal","meeting_id":"meeting-1","target_user":"johny","signal_type":"offer","data":{"type":"offer","sdp":"v=0..."}}"#;
        let msg: ClientMsg = serde_json::from_str(json).unwrap();
        match msg {
            ClientMsg::RtcSignal { meeting_id, target_user, signal_type, .. } => {
                assert_eq!(meeting_id, "meeting-1");
                assert_eq!(target_user, "johny");
                assert_eq!(signal_type, "offer");
            }
            _ => panic!("Expected RtcSignal"),
        }
    }

    #[test]
    fn test_rtc_signal_deserialization() {
        let json = r#"{"type":"rtc_signal","meeting_id":"m-1","target_user":"johny","signal_type":"offer","data":{"type":"offer","sdp":"test"}}"#;
        let msg: ClientMsg = serde_json::from_str(json).unwrap();
        match msg {
            ClientMsg::RtcSignal { meeting_id, target_user, signal_type, data } => {
                assert_eq!(meeting_id, "m-1");
                assert_eq!(target_user, "johny");
                assert_eq!(signal_type, "offer");
                assert!(data.get("sdp").is_some());
            }
            _ => panic!("Expected RtcSignal"),
        }
    }

    #[test]
    fn test_rtc_signal_ice_candidate() {
        let json = r#"{"type":"rtc_signal","meeting_id":"m-1","target_user":"johny","signal_type":"ice_candidate","data":{"candidate":"candidate:1 1 UDP 2122252543 192.168.1.1 50000 typ host","sdpMid":"0","sdpMLineIndex":0}}"#;
        let msg: ClientMsg = serde_json::from_str(json).unwrap();
        match msg {
            ClientMsg::RtcSignal { signal_type, data, .. } => {
                assert_eq!(signal_type, "ice_candidate");
                assert!(data.get("candidate").is_some());
                assert!(data.get("sdpMLineIndex").is_some());
            }
            _ => panic!("Expected RtcSignal"),
        }
    }

    #[test]
    fn test_server_rtc_signal_serialization() {
        let msg = ServerMsg::RtcSignal {
            meeting_id: "meeting-1".to_string(),
            from_user: "jonpecson".to_string(),
            signal_type: "offer".to_string(),
            data: serde_json::json!({"type": "offer", "sdp": "v=0..."}),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("rtc_signal"));
        assert!(json.contains("from_user"));
        assert!(json.contains("jonpecson"));
    }

    #[test]
    fn test_call_started_broadcast_includes_caller() {
        let msg = ServerMsg::CallStarted {
            meeting_id: "meeting-1".to_string(),
            channel_id: uuid::Uuid::new_v4(),
            started_by: "jonpecson".to_string(),
            channel_name: "general".to_string(),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("call_started"));
        assert!(json.contains("jonpecson"));
        assert!(json.contains("general"));
    }

    #[test]
    fn test_all_call_signal_types_parse() {
        let signal_types = vec!["offer", "answer", "ice_candidate"];
        for st in signal_types {
            let json = format!(
                r#"{{"type":"rtc_signal","meeting_id":"m-1","target_user":"user","signal_type":"{}","data":{{}}}}"#,
                st
            );
            let msg: Result<ClientMsg, _> = serde_json::from_str(&json);
            assert!(msg.is_ok(), "Failed to parse signal_type: {}", st);
        }
    }

    #[test]
    fn test_call_media_events_parse() {
        let events = vec![
            r#"{"type":"call_mute","meeting_id":"m-1"}"#,
            r#"{"type":"call_unmute","meeting_id":"m-1"}"#,
            r#"{"type":"call_video_on","meeting_id":"m-1"}"#,
            r#"{"type":"call_video_off","meeting_id":"m-1"}"#,
            r#"{"type":"call_decline","meeting_id":"m-1"}"#,
        ];
        for json in events {
            let msg: Result<ClientMsg, _> = serde_json::from_str(json);
            assert!(msg.is_ok(), "Failed to parse: {}", json);
        }
    }
}
