import api from './api';

export async function createConversationApi(userId) {
  const res = await api.post(`/messages/conversations/${userId}`);
  return res.data;
}

export async function deleteConversationApi(conversationId) {
  const res = await api.delete(`/messages/conversations/${conversationId}`);
  return res.data;
}