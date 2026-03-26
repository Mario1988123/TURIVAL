'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Search, X, Plus, User, Building2 } from 'lucide-react'
import Link from 'next/link'

interface Cliente {
  id: string
  nombre_comercial: string
  razon_social?: string
  email?: string
  telefono?: string
}

interface ClientSearchProps {
  onSelect: (cliente: Cliente) => void
  selectedClient?: Cliente | null
  placeholder?: string
}

export function ClientSearch({ onSelect, selectedClient, placeholder = "Buscar cliente..." }: ClientSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const searchClients = async () => {
      if (query.length < 2) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const { data } = await supabase
          .from('clientes')
          .select('id, nombre_comercial, razon_social, email, telefono')
          .eq('activo', true)
          .or(`nombre_comercial.ilike.%${query}%,razon_social.ilike.%${query}%,email.ilike.%${query}%`)
          .order('nombre_comercial')
          .limit(10)

        setResults(data || [])
      } catch (err) {
        console.error('Error searching clients:', err)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(searchClients, 300)
    return () => clearTimeout(debounce)
  }, [query, supabase])

  const handleSelect = (cliente: Cliente) => {
    onSelect(cliente)
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onSelect({ id: '', nombre_comercial: '' })
    setQuery('')
  }

  if (selectedClient?.id) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Building2 className="w-5 h-5 text-blue-600" />
        <div className="flex-1">
          <p className="font-medium text-blue-900">{selectedClient.nombre_comercial}</p>
          {selectedClient.email && (
            <p className="text-xs text-blue-600">{selectedClient.email}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto shadow-lg border">
          {results.length > 0 ? (
            <div className="py-1">
              {results.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => handleSelect(cliente)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors border-b last:border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                    {cliente.nombre_comercial.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{cliente.nombre_comercial}</p>
                    {cliente.email && (
                      <p className="text-sm text-slate-500 truncate">{cliente.email}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="p-4 text-center">
              <User className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500 mb-3">No se encontraron clientes</p>
              <Link href="/dashboard/clientes/crear">
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Crear nuevo cliente
                </Button>
              </Link>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
