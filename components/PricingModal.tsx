import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  icon: keyof typeof Ionicons.glyphMap;
  highlight: boolean;
  analogy: string;
  cta: string;
}

interface PricingModalProps {
  visible: boolean;
  onClose: () => void;
  plans: Plan[];
  onUpgrade: (planName: string) => void;
}

const PlanCard: React.FC<{ plan: Plan; onUpgrade: (planName: string) => void }> = ({ plan, onUpgrade }) => (
  <View style={[styles.card, plan.highlight ? styles.highlightBorder : styles.defaultBorder]}>
    <View style={styles.headerRow}>
      <Text style={styles.planName}>{plan.name}</Text>
      <Ionicons name={plan.icon} size={24} color="white" />
    </View>
    <Text style={styles.description}>{plan.description}</Text>
    <Text style={styles.price}>{plan.price}</Text>
    <View style={styles.featureList}>
      {plan.features.map((feature, idx) => (
        <Text key={idx} style={styles.feature}>• {feature}</Text>
      ))}
    </View>
    <Text style={styles.analogy}>{plan.analogy}</Text>
    <TouchableOpacity style={styles.ctaButton} onPress={() => onUpgrade(plan.name)}>
      <Text style={styles.ctaText}>{plan.cta}</Text>
    </TouchableOpacity>
  </View>
);

export const PricingModal: React.FC<PricingModalProps> = ({ visible, onClose, plans, onUpgrade }) => (
  <Modal
    visible={visible}
    animationType="fade"
    transparent
    onRequestClose={onClose}
  >
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Upgrade Your Plan</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal contentContainerStyle={styles.scrollContainer} showsHorizontalScrollIndicator={false}>
          {plans.map((plan, index) => (
            <PlanCard key={index} plan={plan} onUpgrade={onUpgrade} />
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 1000,
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: screenWidth * 0.2,
    minHeight: screenHeight * 0.48,
    backgroundColor: '#1e1e20',
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    borderWidth: 1,
    elevation: 10,
    justifyContent: 'space-between',
  },
  highlightBorder: {
    borderColor: '#facc15',
  },
  defaultBorder: {
    borderColor: '#3f3f46',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  description: {
    color: '#d4d4d8',
    marginBottom: 6,
    fontSize: 14,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#facc15',
    marginBottom: 8,
  },
  featureList: {
    marginBottom: 12,
  },
  feature: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 4,
  },
  analogy: {
    color: '#facc15',
    fontStyle: 'italic',
    fontSize: 13,
    marginBottom: 10,
  },
  ctaButton: {
    backgroundColor: '#facc15',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
