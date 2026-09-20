import { useEffect, useReducer } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { searchPlaces, type PlaceSuggestion } from '@/lib/map/geocoding';
import type { MapCoordinate } from '@/lib/map/map.types';
import { INITIAL_PLACE_SEARCH, reducePlaceSearch, shouldSearchPlaces } from '@/lib/map/place-search';

export type PlaceSearchPanelProps = {
  title: string;
  subtitle: string;
  placeholder: string;
  emptyHint: string;
  backLabel: string;
  proximity?: MapCoordinate | null;
  onSelect: (place: PlaceSuggestion) => void;
  onBack?: () => void;
  search?: typeof searchPlaces;
  debounceMs?: number;
};

export function PlaceSearchPanel({
  title,
  subtitle,
  placeholder,
  emptyHint,
  backLabel,
  proximity,
  onSelect,
  onBack,
  search = searchPlaces,
  debounceMs = 300,
}: PlaceSearchPanelProps) {
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(reducePlaceSearch, INITIAL_PLACE_SEARCH);

  useEffect(() => {
    if (!shouldSearchPlaces(state.query)) return;
    const id = setTimeout(() => {
      void search(state.query, { proximity })
        .then((suggestions) => dispatch({ type: 'results', suggestions }))
        .catch(() => dispatch({ type: 'failed' }));
    }, debounceMs);
    return () => clearTimeout(id);
  }, [debounceMs, proximity, search, state.query]);

  return (
    <ThemedView testID="place-search-screen" style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            testID="place-search-back"
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold">←</ThemedText>
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
      </View>

      <View style={styles.body}>
        <TextInput
          testID="place-search-input"
          value={state.query}
          placeholder={placeholder}
          placeholderTextColor="#888888"
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
          onChangeText={(query) => {
            dispatch({ type: 'query', query });
          }}
          style={styles.input}
        />

        {!state.open && state.query.trim().length < 2 ? (
          <View testID="place-search-empty" style={styles.emptyState}>
            <ThemedText type="small" themeColor="textSecondary">
              {emptyHint}
            </ThemedText>
          </View>
        ) : null}

        {state.open && state.suggestions.length > 0 ? (
          <ThemedView type="backgroundElement" style={styles.results}>
            <ScrollView
              style={styles.resultsScroll}
              keyboardShouldPersistTaps="handled"
              testID="place-search-results">
              {state.suggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion.id}
                  testID={`place-search-suggestion-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    dispatch({ type: 'select', suggestion });
                    onSelect(suggestion);
                  }}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                  <ThemedText type="small">{suggestion.label}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>
        ) : null}

        {state.open && state.status !== 'loading' && state.suggestions.length === 0 ? (
          <View testID="place-search-empty" style={styles.emptyState}>
            <ThemedText type="small" themeColor="textSecondary">
              {emptyHint}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#ffffff',
    fontSize: 16,
    minHeight: 48,
  },
  emptyState: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  results: {
    borderRadius: Spacing.two,
    overflow: 'hidden',
    flexShrink: 1,
  },
  resultsScroll: {
    flexGrow: 0,
  },
  suggestion: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  pressed: {
    opacity: 0.7,
  },
});