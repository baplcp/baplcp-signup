import { invokeLineFunction } from '~/services/edgeFunctionClient'

export async function listMembersForApproval(liffStore) {
  const result = await invokeLineFunction(liffStore, 'member-profile', { action: 'list-members' })
  return Array.isArray(result?.members) ? result.members : []
}

export async function approveMember(liffStore, memberId) {
  return invokeLineFunction(liffStore, 'member-profile', { action: 'approve-member', memberId })
}
