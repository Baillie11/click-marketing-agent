export function publicAiError(error: unknown) {
  const value = error as { status?: number; code?: string; message?: string };
  const message = value?.message ?? '';
  if (/organization must be verified/i.test(message)) {
    return {
      statusCode: 503,
      message: 'OpenAI organisation verification is required for the configured model. Verify the organisation in OpenAI Platform settings, wait up to 15 minutes, then try again.',
      actionUrl: 'https://platform.openai.com/settings/organization/general',
    };
  }
  if (value?.status === 401)
    return { statusCode: 503, message: 'The OpenAI API key was rejected. Check OPENAI_API_KEY and restart the application.' };
  if (value?.status === 429)
    return { statusCode: 429, message: 'OpenAI usage or rate limit reached. Check API billing and limits, then try again.' };
  if (value?.status === 404 && /model/i.test(message))
    return { statusCode: 503, message: 'The configured OpenAI model is not available to this API project. Check OPENAI_MODEL or the project’s model access.' };
  if (value?.status && value.status >= 400)
    return { statusCode: 502, message: 'OpenAI could not complete the generation request. Check the API project configuration and try again.' };
  return null;
}
