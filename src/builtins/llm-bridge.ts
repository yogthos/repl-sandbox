/**
 * Injectable LLM query bridge wrappers for VM sandbox.
 *
 * Requires `__llmQueryBridge` (async function) in the VM context.
 * Exposes `llm_query(prompt, options)` and `batch_llm_query(prompts, options)`.
 */
export const LLM_QUERY_IMPL = `
async function llm_query(prompt, options) {
  return await __llmQueryBridge(prompt, options);
}

async function batch_llm_query(prompts, options) {
  if (!prompts || prompts.length === 0) return [];
  var promises = prompts.map(function(prompt) {
    return __llmQueryBridge(prompt, options);
  });
  return await Promise.all(promises);
}
`;
