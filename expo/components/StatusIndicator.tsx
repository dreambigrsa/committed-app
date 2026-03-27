import React from 'react';
import { View, StyleSheet } from 'react-native';
import { UserStatusType } from '@/types';

interface StatusIndicatorProps {
  status: UserStatusType;
  size?: 'small' | 'medium' | 'large';
  showBorder?: boolean;
}

export default function StatusIndicator({ 
  status, 
  size = 'medium',
  showBorder = true 
}: StatusIndicatorProps) {
  const styles = createStyles(size, showBorder);
  
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return '#4CAF50'; // Green
      case 'away':
        return '#FFC107'; // Yellow/Amber
      case 'busy':
        return '#F44336'; // Red
      case 'offline':
      default:
        return '#9E9E9E'; // Gray
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() }]} />
  );
}

const createStyles = (size: 'small' | 'medium' | 'large', showBorder: boolean) => {
  const dotSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  const borderSize = size === 'small' ? 2 : size === 'medium' ? 2.5 : 3;
  
  return StyleSheet.create({
    container: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
      position: 'absolute',
      bottom: -1,
      right: -1,
      borderWidth: showBorder ? borderSize : 0,
      borderColor: '#FFFFFF',
      zIndex: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
  });
};

