import { invokeLineFunction } from '~/services/edgeFunctionClient'

export async function invokeRegistrationAction(liffStore, body) {
  await invokeLineFunction(liffStore, 'registration-action', body)
}
