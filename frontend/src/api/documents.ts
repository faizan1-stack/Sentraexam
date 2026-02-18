import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  Document,
  DocumentCategory,
  CreateDocumentPayload,
  PaginatedResponse
} from '../types';

// List documents
export const listDocuments = async (params?: {
  category?: number;
  department?: number;
  access_level?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Document>> => {
  const { data } = await apiClient.get<PaginatedResponse<Document>>('/documents/', {
    params,
  });
  return data;
};

export const useDocuments = (params?: {
  category?: number;
  department?: number;
  access_level?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => listDocuments(params),
  });
};

// Get single document
export const getDocument = async (id: string): Promise<Document> => {
  const { data } = await apiClient.get<Document>(`/documents/${id}/`);
  return data;
};

export const useDocument = (id: string) => {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
    enabled: !!id,
  });
};

// Create document
export const createDocument = async (payload: CreateDocumentPayload): Promise<Document> => {
  console.log('Creating document with payload:', payload);

  // Use FormData for file uploads
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('access_level', payload.access_level);
  formData.append('file', payload.file);

  if (payload.category) {
    formData.append('category', payload.category);
  }
  if (payload.department) {
    formData.append('department', payload.department);
  }
  if (payload.course) {
    formData.append('course', payload.course);
  }

  // Debug: Log FormData contents
  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}:`, value);
  }

  try {
    const { data } = await apiClient.post<Document>('/documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  } catch (error: any) {
    console.error('Document upload error response:', error.response?.data);
    console.error('Document upload error status:', error.response?.status);
    throw error;
  }
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

// Update document
export const updateDocument = async (
  id: string,
  payload: Partial<CreateDocumentPayload>
): Promise<Document> => {
  const { data } = await apiClient.patch<Document>(`/documents/${id}/`, payload);
  return data;
};

export const useUpdateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateDocumentPayload> }) =>
      updateDocument(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', variables.id] });
    },
  });
};

// Delete document
export const deleteDocument = async (id: string): Promise<void> => {
  await apiClient.delete(`/documents/${id}/`);
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

// Download document
export const downloadDocument = async (id: string): Promise<Blob> => {
  const { data } = await apiClient.get<Blob>(`/documents/${id}/download/`, {
    responseType: 'blob',
  });
  return data;
};

export const useDownloadDocument = () => {
  return useMutation({
    mutationFn: downloadDocument,
  });
};

// Upload document file
export const uploadDocumentFile = async (
  id: string,
  file: File
): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.patch<Document>(`/documents/${id}/upload/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const useUploadDocumentFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadDocumentFile(id, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', variables.id] });
    },
  });
};

// Document categories
export const listDocumentCategories = async (params?: {
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<DocumentCategory>> => {
  const { data } = await apiClient.get<PaginatedResponse<DocumentCategory>>('/documents/categories/', {
    params,
  });
  return data;
};

export const useDocumentCategories = (params?: {
  search?: string;
}) => {
  return useQuery({
    queryKey: ['document-categories', params],
    queryFn: () => listDocumentCategories(params),
  });
};

// Create document category
export const createDocumentCategory = async (payload: {
  name: string;
  description?: string;
}): Promise<DocumentCategory> => {
  const { data } = await apiClient.post<DocumentCategory>('/documents/categories/', payload);
  return data;
};

export const useCreateDocumentCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDocumentCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-categories'] });
    },
  });
};

// Update document category
export const updateDocumentCategory = async (
  id: number,
  payload: Partial<{ name: string; description?: string }>
): Promise<DocumentCategory> => {
  const { data } = await apiClient.patch<DocumentCategory>(`/documents/categories/${id}/`, payload);
  return data;
};

export const useUpdateDocumentCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<{ name: string; description?: string }> }) =>
      updateDocumentCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-categories'] });
    },
  });
};

// Delete document category
export const deleteDocumentCategory = async (id: number): Promise<void> => {
  await apiClient.delete(`/documents/categories/${id}/`);
};

export const useDeleteDocumentCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocumentCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-categories'] });
    },
  });
};