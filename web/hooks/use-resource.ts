"use client"

import { useCallback, useEffect, useState } from "react"

import { api, toApiError, type ApiError } from "@/lib/api"

type State<T> = { data?: T; error?: ApiError; loading: boolean }

/**
 * Membaca satu resource GET. `reload` dipanggil sesudah mutasi supaya layar
 * menampilkan keadaan server, bukan tebakan klien.
 */
export function useResource<T>(path: string) {
  const [state, setState] = useState<State<T>>({ loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api<T>(path, { signal: controller.signal })
      .then((data) => setState({ data, loading: false }))
      .catch((err) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ data: prev.data, error: toApiError(err), loading: false }))
      })
    return () => controller.abort()
  }, [path, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
