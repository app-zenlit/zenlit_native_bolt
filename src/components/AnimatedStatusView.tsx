import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MapPin, EyeOff, Users, FileText, Search } from 'lucide-react-native';
import { theme } from '../styles/theme';

type AnimatedStatusViewProps = {
    title: string;
    subtitle: string;
    icon?: 'map-pin' | 'eye-off' | 'users' | 'file-text' | 'search';
    style?: ViewStyle;
};

export const AnimatedStatusView: React.FC<AnimatedStatusViewProps> = ({
    title,
    subtitle,
    icon = 'map-pin',
    style,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1.2,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0.2,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0.5,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        pulse.start();

        return () => pulse.stop();
    }, [scaleAnim, opacityAnim]);

    const getIcon = () => {
        switch (icon) {
            case 'eye-off':
                return EyeOff;
            case 'users':
                return Users;
            case 'file-text':
                return FileText;
            case 'search':
                return Search;
            default:
                return MapPin;
        }
    };

    const IconComponent = getIcon();
    const iconColor = icon === 'map-pin' ? theme.colors.primary : theme.colors.muted;

    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconContainer}>
                <Animated.View
                    style={[
                        styles.pulseCircle,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                            backgroundColor: iconColor,
                        },
                    ]}
                />
                <IconComponent size={48} color={iconColor} style={styles.icon} />
            </View>
            <Text style={[styles.title, { color: iconColor }]}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 48,
    },
    iconContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        position: 'relative',
    },
    pulseCircle: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    icon: {
        zIndex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    subtitle: {
        color: theme.colors.muted,
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: '80%',
    },
});
