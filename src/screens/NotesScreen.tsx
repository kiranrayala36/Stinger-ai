import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Icon } from 'react-native-elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChecklistItem, noteService } from '../services/noteService';
import { Swipeable } from 'react-native-gesture-handler';

type RootStackParamList = {
  MainTabs: {
    screen?: 'Notes';
    params?: {
      refresh?: boolean;
    };
  };
  Trash: undefined;
};

type Note = {
  id: string;
  title: string;
  content?: string;
  type: 'plain' | 'checklist';
  checklist?: ChecklistItem[];
  date: string;
  color: string;
  category: string;
  tags: string[];
  isArchived: boolean;
  isTemplate: boolean;
  isTrashed?: boolean;
  isBookmarked?: boolean;
  lastModified: string;
};

type NotesScreenRouteProp = RouteProp<RootStackParamList, 'MainTabs'>;
type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const noteColors = ['#2563EB', '#4ADE80', '#38BDF8', '#FACC15', '#FB923C', '#F87171'];
const categories = ['All', 'Work', 'Personal', 'Study', 'Health'];
const NOTE_TYPES = [
  { label: 'Plain', value: 'plain' },
  { label: 'Checklist', value: 'checklist' },
];

const ChecklistItemComponent = ({ 
  item, 
  index, 
  onToggle, 
  onTextChange, 
  onDelete,
  isEditing 
}: { 
  item: ChecklistItem; 
  index: number; 
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onDelete: () => void;
  isEditing: boolean;
}) => {
  const handleDelete = () => {
    onDelete();
  };

  return (
    <View style={styles.checklistItem}>
      <TouchableOpacity
        style={[styles.checkCircle, item.checked && styles.checkCircleChecked]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        {item.checked && (
          <Icon 
            name="check" 
            type="feather" 
            color="#2563EB" 
            size={14}
          />
        )}
      </TouchableOpacity>
      {isEditing ? (
        <TextInput
          style={[
            styles.checklistInput,
            item.checked && styles.checklistTextChecked
          ]}
          value={item.text}
          onChangeText={onTextChange}
          placeholder="Add item..."
          placeholderTextColor="#666"
          autoFocus={!item.text}
        />
      ) : (
        <Text 
          style={[
            styles.checklistText,
            item.checked && styles.checklistTextChecked
          ]}
          numberOfLines={1}
        >
          {item.text}
        </Text>
      )}
      {isEditing && (
        <TouchableOpacity 
          onPress={handleDelete}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="x" type="feather" color="#A1A4B2" size={16} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function NotesScreen() {
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const route = useRoute<NotesScreenRouteProp>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({
    title: '',
    content: '',
    type: 'plain',
    category: 'Personal',
    color: '#ffffff',
    checklist: [],
    tags: [],
    isTrashed: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newTag, setNewTag] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(noteColors[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteType, setNoteType] = useState<'plain' | 'checklist'>('plain');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    const params = route.params;
    if (params?.params?.refresh) {
      loadNotes();
      navigation.setParams({ params: { refresh: undefined } });
    }
  }, [route.params]);

  useEffect(() => {
    filterNotes();
  }, [searchQuery, notes, selectedCategory, selectedTags]);

  const loadNotes = async () => {
    try {
      const allNotes = await noteService.getNotes();
      const activeNotes = allNotes.filter(note => !note.isTrashed);
      setNotes(activeNotes);
      setFilteredNotes(activeNotes);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = notes.filter(note => !note.isTrashed);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(query) || 
        (note.content || '').toLowerCase().includes(query)
      );
    }

    if (selectedCategory && selectedCategory !== 'All') {
      filtered = filtered.filter(note => note.category === selectedCategory);
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(note => 
        selectedTags.every(tag => note.tags.includes(tag))
      );
    }

    setFilteredNotes(filtered);
  };

  const saveNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the note');
      return;
    }
    
    if (noteType === 'checklist') {
      const validChecklist = checklist.filter(item => item.text.trim());
      if (validChecklist.length === 0) {
      Alert.alert('Error', 'Please add at least one checklist item');
      return;
    }
      setChecklist(validChecklist);
    } else if (!noteContent.trim()) {
      Alert.alert('Error', 'Please enter content for the note');
      return;
    }

    if (editingNote) {
      const updatedNote: Note = {
        ...editingNote,
        title: noteTitle.trim(),
        type: noteType,
        content: noteType === 'plain' ? noteContent.trim() : undefined,
        checklist: noteType === 'checklist' ? checklist.filter(item => item.text.trim()) : undefined,
        color: selectedColor,
        category: selectedCategory || 'Other',
        tags: selectedTags || [],
        lastModified: new Date().toISOString(),
        isBookmarked: editingNote.isBookmarked || false,
      };
      try {
        await noteService.updateNote(updatedNote.id, updatedNote);
        setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
        setModalVisible(false);
        setEditingNote(null);
        resetForm();
      } catch (error) {
        Alert.alert('Error', 'Failed to update note');
      }
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title: noteTitle.trim(),
        type: noteType,
        content: noteType === 'plain' ? noteContent.trim() : undefined,
        checklist: noteType === 'checklist' ? checklist.filter(item => item.text.trim()) : undefined,
        date: new Date().toLocaleDateString(),
        color: selectedColor,
        category: selectedCategory || 'Other',
        tags: selectedTags || [],
        isArchived: false,
        isTemplate: false,
        isBookmarked: false,
        lastModified: new Date().toISOString(),
      };
      try {
        await noteService.addNote(newNote);
        setNotes([newNote, ...notes]);
        setModalVisible(false);
        resetForm();
      } catch (error) {
        Alert.alert('Error', 'Failed to save note');
      }
    }
  };

  const resetForm = () => {
    setNoteTitle('');
    setNoteContent('');
    setSelectedColor(noteColors[0]);
    setSelectedCategory('All');
    setSelectedTags([]);
    setNewTag('');
    setNoteType('plain');
    setChecklist([]);
  };

  const addTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const addChecklistItem = () => {
    const newItem: ChecklistItem = { text: '', checked: false };
    setChecklist(prevChecklist => [...prevChecklist, newItem]);
  };

  const removeChecklistItem = (idx: number) => {
    setChecklist(prevChecklist => {
      const newChecklist = prevChecklist.filter((_, i) => i !== idx);
      if (newChecklist.length === 0) {
        return [{ text: '', checked: false }];
      }
      return newChecklist;
    });
  };

  const updateChecklistItem = (idx: number, text: string) => {
    setChecklist(prevChecklist => 
      prevChecklist.map((item, i) => 
        i === idx ? { ...item, text } : item
      )
    );
  };

  const toggleChecklistItem = (idx: number) => {
    setChecklist(prevChecklist => 
      prevChecklist.map((item, i) => 
        i === idx ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const moveToTrash = async (note: Note) => {
    const trashedNote = { ...note, isTrashed: true, lastModified: new Date().toISOString() };
    await noteService.updateNote(note.id, trashedNote);
    setNotes(notes => notes.map(n => n.id === note.id ? trashedNote : n));
  };

  const toggleBookmark = async (note: Note) => {
    try {
      const updatedNote = { 
        ...note, 
        isBookmarked: !note.isBookmarked,
        lastModified: new Date().toISOString() 
      };
      await noteService.updateNote(note.id, updatedNote);
      setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
    } catch (error) {
      Alert.alert('Error', 'Failed to update bookmark status');
    }
  };

  const renderRightActions = (note: Note) => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => moveToTrash(note)}
    >
      <Icon name="trash-2" type="feather" color="#fff" size={24} />
    </TouchableOpacity>
  );

  const renderNote = ({ item }: { item: Note }) => (
    <View style={styles.noteCardWrapper}>
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <TouchableOpacity
          style={[
            styles.noteCard,
            { borderLeftColor: item.color, backgroundColor: '#23262B' },
          ]}
          activeOpacity={0.8}
          onPress={() => {
            setEditingNote(item);
            setNoteTitle(item.title);
            setNoteContent(item.content || '');
            setSelectedColor(item.color);
            setSelectedCategory(item.category);
            setSelectedTags(item.tags || []);
            setNoteType(item.type);
            setChecklist(item.checklist || []);
            setModalVisible(true);
          }}
        >
          <Text style={[styles.noteTitle, item.type === 'checklist' && { color: '#fff' }]}>{item.title}</Text>
          {item.type === 'plain' && (
            <Text style={styles.noteContent} numberOfLines={3}>{item.content || ''}</Text>
          )}
          {item.type === 'checklist' && Array.isArray(item.checklist) && (
            <View style={styles.checklistContainer}>
              {item.checklist.map((c, idx) => (
                <ChecklistItemComponent
                  key={idx}
                  item={c}
                  index={idx}
                  isEditing={false}
                  onToggle={async () => {
                      const updatedChecklist = item.checklist!.map((ci, i) =>
                        i === idx ? { ...ci, checked: !ci.checked } : ci
                      );
                    const updatedNote = { 
                      ...item, 
                      checklist: updatedChecklist, 
                      lastModified: new Date().toISOString() 
                    };
                      await noteService.updateNote(item.id, updatedNote);
                      setNotes(notes => notes.map(n => n.id === item.id ? updatedNote : n));
                    }}
                  onTextChange={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </View>
          )}
          <View style={styles.noteFooter}>
            <Text style={styles.noteDate}>{item.date}</Text>
            <TouchableOpacity onPress={() => toggleBookmark(item)}>
              <Icon 
                name={item.isBookmarked ? "bookmark" : "bookmark-outline"} 
                type="material-community"
                color={item.isBookmarked ? "#2563EB" : "#A1A4B2"} 
                size={20} 
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Icon name="loader" type="feather" color="#A1A4B2" size={24} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Notes</Text>
          <TouchableOpacity
            style={[styles.addButton, { marginLeft: 8 }]}
            onPress={() => navigation.navigate('Trash')}
          >
            <Icon name="trash-2" type="feather" color="#fff" size={22} />
          </TouchableOpacity>
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                selectedCategory === category && styles.filterChipSelected
              ]}
              onPress={() => setSelectedCategory(
                selectedCategory === category ? 'All' : category
              )}
            >
              <Text style={[
                styles.filterChipText,
                selectedCategory === category && styles.filterChipTextSelected
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" type="feather" color="#A1A4B2" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="x" type="feather" color="#A1A4B2" size={20} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredNotes}
        renderItem={renderNote}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.notesList}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching notes found' : 'No notes yet'}
            </Text>
            <Text style={styles.emptySubText}>
              {searchQuery ? 'Try a different search term' : 'Tap the + button to create a new note'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Icon name="plus" type="feather" color="#fff" size={24} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setEditingNote(null);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNote ? 'Edit Note' : 'New Note'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setEditingNote(null);
                  resetForm();
                }}
              >
                <Icon name="x" type="feather" color="#fff" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <TextInput
                style={styles.titleInput}
                placeholder="Note Title"
                placeholderTextColor="#666"
                value={noteTitle}
                onChangeText={setNoteTitle}
              />

              {noteType === 'plain' ? (
                <TextInput
                  style={styles.contentInput}
                  placeholder="Note Content"
                  placeholderTextColor="#666"
                  value={noteContent}
                  onChangeText={setNoteContent}
                  multiline
                  textAlignVertical="top"
                />
              ) : null}

              <View style={styles.typeContainer}>
                <Text style={styles.modalLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {NOTE_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeChip,
                        noteType === type.value && styles.typeChipSelected
                      ]}
                      onPress={() => setNoteType(type.value as 'plain' | 'checklist')}
                    >
                      <Text style={[
                        styles.typeChipText,
                        noteType === type.value && styles.typeChipTextSelected
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {noteType === 'checklist' && (
                <View style={styles.checklistContainer}>
                  <Text style={styles.modalLabel}>Checklist Items</Text>
                  {checklist.map((item, idx) => (
                    <ChecklistItemComponent
                      key={idx}
                      item={item}
                      index={idx}
                      isEditing={true}
                      onToggle={() => toggleChecklistItem(idx)}
                      onTextChange={(text) => updateChecklistItem(idx, text)}
                      onDelete={() => removeChecklistItem(idx)}
                    />
                  ))}
                  <TouchableOpacity
                    style={styles.addItemButton}
                    onPress={addChecklistItem}
                  >
                    <Icon name="plus" type="feather" color="#2563EB" size={20} />
                    <Text style={styles.addItemText}>Add Item</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.categoryContainer}>
                <Text style={styles.modalLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {categories.map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category && styles.categoryChipSelected
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        selectedCategory === category && styles.categoryChipTextSelected
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.tagsContainer}>
                <Text style={styles.modalLabel}>Tags</Text>
                <View style={styles.tagInputContainer}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Add a tag..."
                    placeholderTextColor="#666"
                    value={newTag}
                    onChangeText={setNewTag}
                    onSubmitEditing={addTag}
                  />
                  <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
                    <Icon name="plus" type="feather" color="#fff" size={20} />
                  </TouchableOpacity>
                </View>
                <View style={styles.tagsList}>
                  {selectedTags.map(tag => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                      <TouchableOpacity onPress={() => removeTag(tag)}>
                        <Icon name="x" type="feather" color="#fff" size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={styles.modalLabel}>Color</Text>
              <View style={styles.colorPicker}>
                {noteColors.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>
              
              <View style={styles.bottomSpacing} />
            </ScrollView>

            <View style={styles.saveButtonContainer}>
              <TouchableOpacity style={styles.saveButton} onPress={saveNote}>
                <Text style={styles.saveButtonText}>
                  {editingNote ? 'Update Note' : 'Save Note'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#181A20',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#23262B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesList: {
    padding: 16,
  },
  noteCardWrapper: {
    flex: 1,
    margin: 4,
  },
  noteCard: {
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
    color: '#A1A4B2',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#A1A4B2',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#23262B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  titleInput: {
    backgroundColor: '#35383F',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
    fontWeight: '500',
  },
  contentInput: {
    backgroundColor: '#35383F',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    height: 150,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  modalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeContainer: {
    marginBottom: 20,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#35383F',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  typeChipText: {
    color: '#A1A4B2',
    fontSize: 14,
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#35383F',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  categoryChipText: {
    color: '#A1A4B2',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  tagsContainer: {
    marginBottom: 20,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#35383F',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    fontSize: 16,
  },
  addTagButton: {
    padding: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipText: {
    color: '#fff',
    marginRight: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  checklistContainer: {
    marginBottom: 20,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    backgroundColor: '#35383F',
    borderRadius: 12,
    padding: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A1A4B2',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkCircleChecked: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  checklistInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 4,
    marginRight: 8,
  },
  checklistText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  checklistTextChecked: {
    color: '#A1A4B2',
    textDecorationLine: 'line-through',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#35383F',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  addItemText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23262B',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    fontSize: 16,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#23262B',
    marginRight: 8,
    marginLeft: 16,
  },
  filterChipSelected: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    color: '#A1A4B2',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  swipeDelete: {
    backgroundColor: '#F87171',
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    height: '90%',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 120 : 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  modalScrollContent: {
    padding: 24,
  },
  saveButtonContainer: {
    backgroundColor: '#23262B',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomSpacing: {
    height: 20,
  },
}); 