import React, { useState, useEffect } from 'react';
import CustomAlert from './CustomAlert';
import { setCustomAlertHandler } from '../utils/alert';

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: {
      text: string;
      onPress: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  useEffect(() => {
    setCustomAlertHandler((config) => {
      setAlertConfig({
        visible: true,
        ...config
      });
    });

    return () => setCustomAlertHandler(null);
  }, []);

  const handleDismiss = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  return (
    <>
      {children}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons?.map(button => ({
          ...button,
          onPress: () => {
            handleDismiss();
            button.onPress();
          }
        })) || []}
        onDismiss={handleDismiss}
      />
    </>
  );
}; 