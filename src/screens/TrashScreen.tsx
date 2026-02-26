import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { noteService, Note } from '../services/noteService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-elements';
import CustomAlert from '../components/CustomAlert';

type RootStackParamList = {
  MainTabs: {
    screen?: 'Notes';
    params?: {
      refresh?: boolean;
    };
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TrashScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [trashedNotes, setTrashedNotes] = useState<Note[]>([]);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [deleteAllAlertVisible, setDeleteAllAlertVisible] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  useEffect(() => {
    const loadTrashedNotes = async () => {
      const notes = await noteService.getNotes();
      setTrashedNotes(notes.filter(note => note.isTrashed));
    };
    loadTrashedNotes();
  }, []);

  const handleRestore = async (note: Note) => {
    try {
      const restoredNote = { ...note, isTrashed: false, lastModified: new Date().toISOString() };
      await noteService.updateNote(note.id, restoredNote);
    setTrashedNotes(notes => notes.filter(n => n.id !== note.id));
    } catch (error) {
      Alert.alert('Error', 'Failed to restore note');
    }
  };

  const handleDelete = async (note: Note) => {
    setNoteToDelete(note);
    setDeleteAlertVisible(true);
  };

  const confirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await noteService.deleteNote(noteToDelete.id);
      setTrashedNotes(notes => notes.filter(n => n.id !== noteToDelete.id));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete note');
    } finally {
      setDeleteAlertVisible(false);
      setNoteToDelete(null);
    }
  };

  const handleDeleteAll = () => {
    setDeleteAllAlertVisible(true);
  };

  const confirmDeleteAll = async () => {
            try {
              await Promise.all(trashedNotes.map(note => noteService.deleteNote(note.id)));
              setTrashedNotes([]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete all notes');
    } finally {
      setDeleteAllAlertVisible(false);
            }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" type="feather" color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.header}>Trash</Text>
        </View>
        {trashedNotes.length > 0 && (
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={handleDeleteAll}
          >
            <Text style={[styles.deleteAllText, { color: '#A1A4B2' }]}>Delete All</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={trashedNotes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>{item.title}</Text>
            <Text style={styles.noteContent}>{item.content}</Text>
            <View style={styles.trashActions}>
              <TouchableOpacity
                style={styles.trashButton}
                onPress={() => handleRestore(item)}
              >
                <Text style={[styles.trashButtonText, { color: '#A1A4B2' }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.trashButton}
                onPress={() => handleDelete(item)}
              >
                <Text style={[styles.trashButtonText, { color: '#A1A4B2' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No notes in trash.</Text>}
      />

      <CustomAlert
        visible={deleteAlertVisible}
        title="Delete Note"
        message="Are you sure you want to permanently delete this note? This action cannot be undone."
        buttons={[
          { 
            text: 'Cancel', 
            onPress: () => {
              setDeleteAlertVisible(false);
              setNoteToDelete(null);
            },
            style: 'cancel'
          },
          { 
            text: 'Delete', 
            onPress: confirmDelete,
            style: 'destructive'
          }
        ]}
      />

      <CustomAlert
        visible={deleteAllAlertVisible}
        title="Delete All Notes"
        message="Are you sure you want to permanently delete all notes in trash? This action cannot be undone."
        buttons={[
          { 
            text: 'Cancel', 
            onPress: () => setDeleteAllAlertVisible(false),
            style: 'cancel'
          },
          { 
            text: 'Delete All', 
            onPress: confirmDeleteAll,
            style: 'destructive'
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  deleteAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteAllText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  noteCard: {
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  noteTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noteContent: {
    color: '#A1A4B2',
    fontSize: 14,
  },
  emptyText: {
    color: '#A1A4B2',
    textAlign: 'center',
    marginTop: 40,
  },
  trashActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  trashButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  trashButtonText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
}); 