'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types/erp'

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>(null)
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    rol: 'usuario' as 'usuario' | 'admin',
  })

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.rol !== 'admin') {
        router.push('/dashboard')
        return
      }

      setUser(profile as Profile)
      loadUsuarios()
    }

    checkAuth()
  }, [router, supabase])

  async function loadUsuarios() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('fecha_alta', { ascending: false })

      setUsuarios(data || [])
    } catch (err) {
      console.error('Error cargando usuarios:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Crear usuario en auth
      const { data: authUser, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        alert('Error creando usuario: ' + signUpError.message)
        return
      }

      if (authUser.user) {
        // Crear perfil
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.user.id,
            email: formData.email,
            nombre: formData.nombre,
            rol: formData.rol,
          })

        if (profileError) {
          alert('Error creando perfil: ' + profileError.message)
          return
        }

        alert('Usuario creado exitosamente')
        setFormData({ email: '', password: '', nombre: '', rol: 'usuario' })
        setShowForm(false)
        loadUsuarios()
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Error creando usuario')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Panel de Administración</h1>
          <p className="text-slate-600">Gestiona usuarios del sistema</p>
        </div>

        {/* Create User Form */}
        {showForm && (
          <Card className="p-6 mb-8 bg-white border-0 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-slate-900">Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre
                  </label>
                  <Input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="juan@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contraseña
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Rol
                  </label>
                  <Select value={formData.rol} onValueChange={(v: any) => setFormData({ ...formData, rol: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? 'Creando...' : 'Crear Usuario'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {!showForm && (
          <div className="mb-6">
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              + Crear Usuario
            </Button>
          </div>
        )}

        {/* Users List */}
        <Card className="bg-white border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Fecha Alta
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                      {u.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          u.rol === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {u.rol === 'admin' ? 'Admin' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {u.fecha_alta ? new Date(u.fecha_alta).toLocaleDateString('es-ES') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Activo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {usuarios.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No hay usuarios registrados aún
          </div>
        )}
      </div>
    </div>
  )
}
