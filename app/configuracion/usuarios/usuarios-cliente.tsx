'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Users, ShieldCheck, UserPlus, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import {
  accionAsignarRol,
  accionCrearUsuario,
  accionEliminarUsuario,
} from '@/lib/actions/auth-roles'
import {
  MODULOS_DISPONIBLES,
  type PerfilUsuario,
  type RolUsuario,
} from '@/lib/types/auth-roles'

interface Props {
  perfilesIniciales: PerfilUsuario[]
}

export default function UsuariosCliente({ perfilesIniciales }: Props) {
  const router = useRouter()
  const [perfiles, setPerfiles] = useState<PerfilUsuario[]>(perfilesIniciales)
  const [, startTransition] = useTransition()

  function actualizarPerfil(p: PerfilUsuario) {
    setPerfiles((prev) => {
      const idx = prev.findIndex((x) => x.user_id === p.user_id)
      if (idx === -1) return [p, ...prev]
      const next = [...prev]; next[idx] = p; return next
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gestión de usuarios y roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea operarios y asigna a cada uno los módulos que puede ver. Los admins
            ven todo.
          </p>
        </div>
        <DialogCrearUsuario onCreado={actualizarPerfil} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios registrados ({perfiles.length})</CardTitle>
          <CardDescription>Pulsa un usuario para editar su rol y módulos.</CardDescription>
        </CardHeader>
        <CardContent>
          {perfiles.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              No hay usuarios todavía. Pulsa <strong>Crear usuario</strong> arriba para empezar.
            </div>
          ) : (
            <ul className="divide-y">
              {perfiles.map((p) => (
                <li key={p.user_id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.nombre || p.email || p.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.email} · <span className="font-mono">{p.user_id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <Badge variant={p.rol === 'admin' ? 'default' : p.rol === 'operario' ? 'secondary' : 'outline'}>
                    {p.rol}
                  </Badge>
                  {p.modulos_permitidos.includes('*') ? (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      todos los módulos
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {p.modulos_permitidos.length} módulo{p.modulos_permitidos.length === 1 ? '' : 's'}
                    </Badge>
                  )}
                  {!p.activo && <Badge variant="destructive">inactivo</Badge>}
                  <DialogAsignar
                    onSaved={actualizarPerfil}
                    perfilExistente={p}
                  />
                  <BotonEliminar perfil={p} onEliminado={() => setPerfiles(prev => prev.filter(x => x.user_id !== p.user_id))} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================
// Dialog para CREAR un usuario nuevo end-to-end (auth + perfil)
// =============================================================

function DialogCrearUsuario({ onCreado }: { onCreado: (p: PerfilUsuario) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<RolUsuario>('operario')
  const [modulos, setModulos] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleModulo(slug: string) {
    setModulos((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug); else next.add(slug)
      return next
    })
  }

  function reset() {
    setEmail(''); setPassword(''); setNombre(''); setRol('operario')
    setModulos(new Set()); setError(null)
  }

  async function guardar() {
    setEnviando(true)
    setError(null)
    try {
      const res = await accionCrearUsuario({
        email: email.trim(),
        password,
        nombre: nombre.trim(),
        rol,
        modulos: rol === 'admin' ? ['*'] : Array.from(modulos),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onCreado(res.perfil)
      reset()
      setAbierto(false)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Crear usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear usuario nuevo</DialogTitle>
          <DialogDescription>
            Se crea la cuenta en Supabase Auth y se le asigna el rol y los módulos en una sola operación.
            El usuario podrá entrar inmediatamente con su email y contraseña.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Pepe" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pepe@empresa.es" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Contraseña inicial</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            <p className="text-[11px] text-slate-500 mt-1">
              Comunícasela al usuario; podrá cambiarla después en su perfil.
            </p>
          </div>

          <div>
            <Label className="text-xs">Rol</Label>
            <Select value={rol} onValueChange={(v: RolUsuario) => setRol(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin (todo)</SelectItem>
                <SelectItem value="operario">Operario (módulos seleccionados)</SelectItem>
                <SelectItem value="cliente">Cliente (portal externo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rol === 'operario' && (
            <div>
              <Label className="text-xs flex items-center justify-between">
                <span>Módulos permitidos</span>
                <button
                  type="button"
                  onClick={() => setModulos(new Set(MODULOS_DISPONIBLES.map((m) => m.slug)))}
                  className="text-blue-600 hover:underline text-[11px]"
                >
                  marcar todos
                </button>
              </Label>
              <div className="rounded-md border bg-slate-50 p-2 grid grid-cols-2 gap-1 mt-1">
                {MODULOS_DISPONIBLES.map((m) => (
                  <label
                    key={m.slug}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer text-xs"
                  >
                    <Checkbox checked={modulos.has(m.slug)} onCheckedChange={() => toggleModulo(m.slug)} />
                    <span>{m.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {rol === 'admin' && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>El admin tiene acceso a todos los módulos automáticamente.</AlertDescription>
            </Alert>
          )}

          {rol === 'cliente' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Los clientes acceden al portal externo (/cliente). No necesitan módulos del CRM interno.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={guardar} disabled={enviando || !email.trim() || password.length < 6 || !nombre.trim()}>
            {enviando ? 'Creando…' : (<span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Crear usuario</span>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================
// Dialog para EDITAR rol y módulos de un usuario existente
// =============================================================

function DialogAsignar({
  onSaved,
  perfilExistente,
}: {
  onSaved: (p: PerfilUsuario) => void
  perfilExistente: PerfilUsuario
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(perfilExistente.nombre ?? '')
  const [rol, setRol] = useState<RolUsuario>(perfilExistente.rol)
  const [modulos, setModulos] = useState<Set<string>>(new Set(perfilExistente.modulos_permitidos ?? []))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleModulo(slug: string) {
    setModulos((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug); else next.add(slug)
      return next
    })
  }

  async function guardar() {
    setEnviando(true)
    setError(null)
    try {
      const res = await accionAsignarRol({
        user_id: perfilExistente.user_id,
        rol,
        nombre: nombre.trim(),
        email: perfilExistente.email,
        modulos: rol === 'admin' ? ['*'] : Array.from(modulos),
      })
      if (!res.ok) { setError(res.error); return }
      onSaved(res.perfil)
      setAbierto(false)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            {perfilExistente.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Rol</Label>
            <Select value={rol} onValueChange={(v: RolUsuario) => setRol(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin (todo)</SelectItem>
                <SelectItem value="operario">Operario (módulos seleccionados)</SelectItem>
                <SelectItem value="cliente">Cliente (portal externo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rol === 'operario' && (
            <div>
              <Label className="text-xs flex items-center justify-between">
                <span>Módulos permitidos</span>
                <button
                  type="button"
                  onClick={() => setModulos(new Set(MODULOS_DISPONIBLES.map((m) => m.slug)))}
                  className="text-blue-600 hover:underline text-[11px]"
                >
                  marcar todos
                </button>
              </Label>
              <div className="rounded-md border bg-slate-50 p-2 grid grid-cols-2 gap-1 mt-1">
                {MODULOS_DISPONIBLES.map((m) => (
                  <label
                    key={m.slug}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer text-xs"
                  >
                    <Checkbox checked={modulos.has(m.slug)} onCheckedChange={() => toggleModulo(m.slug)} />
                    <span>{m.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : (<span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Guardar</span>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================
// Botón eliminar usuario (auth.users + usuario_perfiles)
// =============================================================

function BotonEliminar({ perfil, onEliminado }: { perfil: PerfilUsuario; onEliminado: () => void }) {
  const [enviando, setEnviando] = useState(false)
  async function eliminar() {
    if (!confirm(`¿Eliminar a ${perfil.nombre || perfil.email}? Se borrará la cuenta de Auth y su perfil.`)) return
    setEnviando(true)
    try {
      const res = await accionEliminarUsuario(perfil.user_id)
      if (!res.ok) { alert(res.error); return }
      onEliminado()
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Button size="icon" variant="ghost" onClick={eliminar} disabled={enviando} title="Eliminar usuario">
      <Trash2 className="h-4 w-4 text-red-600" />
    </Button>
  )
}
