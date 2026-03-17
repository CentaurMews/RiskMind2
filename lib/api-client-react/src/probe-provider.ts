import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface ProbeProviderRequest {
  providerType: "openai_compat" | "anthropic";
  vendor?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProbeProviderResult {
  success: boolean;
  message: string;
  models: string[];
  latencyMs: number;
  tokensPerSecond?: number;
}

export const VENDOR_BASE_URLS: Record<string, { baseUrl: string; providerType: "openai_compat" | "anthropic" }> = {
  openai: { baseUrl: "https://api.openai.com/v1", providerType: "openai_compat" },
  anthropic: { baseUrl: "", providerType: "anthropic" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", providerType: "openai_compat" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", providerType: "openai_compat" },
  together: { baseUrl: "https://api.together.xyz/v1", providerType: "openai_compat" },
  cohere: { baseUrl: "https://api.cohere.ai/compatibility/v1", providerType: "openai_compat" },
  perplexity: { baseUrl: "https://api.perplexity.ai", providerType: "openai_compat" },
  ollama: { baseUrl: "http://localhost:11434/v1", providerType: "openai_compat" },
  lmstudio: { baseUrl: "http://localhost:1234/v1", providerType: "openai_compat" },
  custom: { baseUrl: "", providerType: "openai_compat" },
};

export type KnownVendor = keyof typeof VENDOR_BASE_URLS;

export const probeProvider = async (
  data: ProbeProviderRequest,
  options?: RequestInit,
): Promise<ProbeProviderResult> => {
  return customFetch<ProbeProviderResult>(`/api/v1/settings/llm-providers/probe`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });
};

export const probeProviderById = async (
  id: string,
  options?: RequestInit,
): Promise<ProbeProviderResult> => {
  return customFetch<ProbeProviderResult>(`/api/v1/settings/llm-providers/${id}/probe`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
};

export const useProbeProvider = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    ProbeProviderResult,
    TError,
    { data: ProbeProviderRequest },
    TContext
  >;
  request?: RequestInit;
}): UseMutationResult<
  ProbeProviderResult,
  TError,
  { data: ProbeProviderRequest },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};

  return useMutation<ProbeProviderResult, TError, { data: ProbeProviderRequest }, TContext>({
    mutationFn: (props) => probeProvider(props.data, requestOptions),
    ...mutationOptions,
  });
};

export const useProbeProviderById = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    ProbeProviderResult,
    TError,
    { id: string },
    TContext
  >;
  request?: RequestInit;
}): UseMutationResult<
  ProbeProviderResult,
  TError,
  { id: string },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};

  return useMutation<ProbeProviderResult, TError, { id: string }, TContext>({
    mutationFn: (props) => probeProviderById(props.id, requestOptions),
    ...mutationOptions,
  });
};
