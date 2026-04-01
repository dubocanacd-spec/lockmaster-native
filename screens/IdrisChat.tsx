import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { COLORS } from '../colors';

const API_BASE = 'https://lockmasterai.co.uk';

interface Message {
  role: 'user' | 'idris';
  text: string;
}

const QUICK_QUESTIONS = [
  '🔒 Nearest lock?',
  '🍺 Nearest pub?',
  '💧 Water point?',
  '🌊 Flood risk?',
];

export default function IdrisChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'idris', text: "Good moaning! I am Idris, your canol navigation assistant. How can I help you navigate the witterways today, you plonker?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const r = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, uuid: 'native-app' }),
      });
      const data = await r.json();
      const reply = data.reply || data.response || "Good moaning! Something went wrong with me circuits, obviously.";
      setMessages(prev => [...prev, { role: 'idris', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'idris', text: "Good moaning! I cannot connect to me brain right now. Check your internet, you plonker!" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.avatar}>👮</Text>
        <View>
          <Text style={styles.headerName}>Idris</Text>
          <Text style={styles.headerSub}>Canal Navigation Officer</Text>
        </View>
        <View style={styles.onlineDot} />
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleIdris]}>
            {msg.role === 'idris' && <Text style={styles.bubbleIcon}>👮</Text>}
            <View style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextIdris]}>
              <Text style={[styles.bubbleMsg, msg.role === 'user' ? styles.bubbleMsgUser : styles.bubbleMsgIdris]}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.bubbleIdris]}>
            <Text style={styles.bubbleIcon}>👮</Text>
            <View style={styles.bubbleTextIdris}>
              <ActivityIndicator color={COLORS.orange} size="small" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick questions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll} contentContainerStyle={styles.quickContent}>
        {QUICK_QUESTIONS.map((q, i) => (
          <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => sendMessage(q)}>
            <Text style={styles.quickText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask Idris..."
          placeholderTextColor={COLORS.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          multiline={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg },

  header:           { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1A1B2E', borderBottomWidth: 1, borderBottomColor: '#2a2b3d', gap: 12 },
  avatar:           { fontSize: 32 },
  headerName:       { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  headerSub:        { color: COLORS.muted, fontSize: 11, marginTop: 1 },
  onlineDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green, marginLeft: 'auto' },

  messages:         { flex: 1 },
  messagesContent:  { padding: 16, gap: 12 },

  bubble:           { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleUser:       { flexDirection: 'row-reverse' },
  bubbleIdris:      { flexDirection: 'row' },
  bubbleIcon:       { fontSize: 24, marginBottom: 4 },
  bubbleText:       { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleTextUser:   { backgroundColor: COLORS.orange, borderBottomRightRadius: 4 },
  bubbleTextIdris:  { backgroundColor: '#1A1B2E', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2b3d' },
  bubbleMsg:        { fontSize: 14, lineHeight: 20 },
  bubbleMsgUser:    { color: COLORS.white },
  bubbleMsgIdris:   { color: COLORS.white },

  quickScroll:      { maxHeight: 44, borderTopWidth: 1, borderTopColor: '#2a2b3d' },
  quickContent:     { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickBtn:         { backgroundColor: '#1A1B2E', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#2a2b3d' },
  quickText:        { color: COLORS.muted, fontSize: 12 },

  inputRow:         { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#1A1B2E', borderTopWidth: 1, borderTopColor: '#2a2b3d' },
  input:            { flex: 1, backgroundColor: COLORS.bg, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: COLORS.white, fontSize: 14, borderWidth: 1, borderColor: '#2a2b3d' },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:  { opacity: 0.4 },
  sendIcon:         { color: COLORS.white, fontSize: 16 },
});
