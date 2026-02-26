import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Icon } from 'react-native-elements';
import { LinearGradient } from 'expo-linear-gradient';

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type CategorySelectorProps = {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
};

const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryButton}
            onPress={() => onSelectCategory(category.id)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={selectedCategory === category.id 
                ? ["#FFE6C7", "#FFDAB9"]
                : ["#23262B", "#2A2D35"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.categoryGradient}
            >
              <Icon
                name={category.icon}
                type="feather"
                color={selectedCategory === category.id ? '#23262B' : '#FFE6C7'}
                size={16}
                style={styles.categoryIcon}
              />
              <Text style={[
                styles.categoryText,
                { color: selectedCategory === category.id ? '#23262B' : '#FFE6C7' }
              ]}>
                {category.name}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  categoryButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  categoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CategorySelector; 