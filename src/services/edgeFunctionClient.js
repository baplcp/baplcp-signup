import { supabase } from '~/utils/supabase'

export async function invokeLineFunction(liffStore, functionName, body) {
  const lineAccessToken = await liffStore.getLineAccessToken()
  if (!lineAccessToken && !import.meta.env.DEV) throw new Error('missing_line_access_token')

  const options = { body }
  if (lineAccessToken) {
    options.headers = { 'x-line-access-token': lineAccessToken }
  }

  const { data, error } = await supabase.functions.invoke(functionName, options)
  if (error) throw error
  return data
}
