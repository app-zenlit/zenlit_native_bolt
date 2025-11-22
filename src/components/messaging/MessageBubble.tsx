import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCheck, Clock3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type MessageStatus = 'pending' | 'failed' | 'sent' | 'delivered' | 'read';

export type MessageBubbleProps = {
  text: string;
  createdAt: string; // ISO string
  isMine?: boolean;
  status?: MessageStatus;
  onRetry?: () => void;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatHHmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const statusIconFor = (status: MessageStatus) => {
  switch (status) {
    case 'pending':
      return { icon: Clock3, color: 'rgba(255,255,255,0.7)' };
    case 'failed':
      return { icon: Clock3, color: '#fca5a5' };
    case 'delivered':
      return { icon: CheckCheck, color: '#ffffff' };
    case 'read':
      return { icon: CheckCheck, color: '#4ade80' };
    case 'sent':
    default:
      return { icon: Check, color: '#ffffff' };
  }
};

const statusDescription: Record<MessageStatus, string> = {
  pending: 'pending',
  failed: 'not sent',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  createdAt,
  isMine = false,
  status = 'sent',
  onRetry,
}) => {
  const timeLabel = formatHHmm(new Date(createdAt));
  const showStatus = isMine;
  const { icon: StatusIcon, color: statusColor } = statusIconFor(status);
  const interactive = status === 'failed' && !!onRetry;
  const accessibilityLabel = `${text || 'Message'}, ${timeLabel}${showStatus ? `, status ${statusDescription[status]}` : ''
    }${interactive ? '. Double tap to retry sending.' : ''}`;

  const innerContent = (
    <>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.time}>{timeLabel}</Text>
        {showStatus ? (
          <StatusIcon strokeWidth={2.5} size={14} color={statusColor} />
        ) : null}
      </View>
    </>
  );

  const content = isMine ? (
    <LinearGradient
      colors={['#2563eb', '#7e22ce']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, styles.mine]}
    >
      {innerContent}
    </LinearGradient>
  ) : (
    <View style={[styles.container, styles.theirs]}>
      {innerContent}
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.pressableWrapper,
          isMine ? styles.wrapperMine : styles.wrapperTheirs,
          pressed ? styles.pressablePressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[styles.pressableWrapper, isMine ? styles.wrapperMine : styles.wrapperTheirs]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  pressableWrapper: {
    maxWidth: '82%',
    marginVertical: 2,
  },
  wrapperMine: {
    alignSelf: 'flex-end',
  },
  wrapperTheirs: {
    alignSelf: 'flex-start',
  },
  pressablePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  mine: {
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: '#1f2937', // Gray-800
    borderBottomLeftRadius: 4,
  },
  text: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular', // Assuming Inter is loaded, fallback will be system
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  time: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default MessageBubble;
