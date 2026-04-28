'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, Trash2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  accionListarDocumentos, accionRegistrarDocumento,
  accionEliminarDocumento, accionUrlFirmada,
} from '@/lib/actions/fichajes-avanzado'
import type { DocumentoOperario, CategoriaDoc } from '@/lib/services/fichajes-avanzado'

const CATEGORIAS: Array<{ v: CategoriaDoc; l: string; color: string }> = [
  { v: 'nomina', l: 'Nómina', color: 'bg-emerald-100 text-emerald-800' },
  { v: 'justificante_medico', l: 'Justificante médico', color: 'bg-red-100 text-red-800' },
  { v: 'contrato', l: 'Contrato', color: 'bg-blue-100 text-blue-800' },
  { v: 'baja_alta_ss', l: 'Baja/Alta SS', color: 'bg-purple-100 text-purple-800' },
  { v: 'ticket_dieta', l: 'Ticket / Dieta', color: 'bg-amber-100 text-amber-800' },
  { v: 'formacion', l: 'Formación', color: 'bg-cyan-100 text-cyan-800' },
  { v: 'otros', l: 'Otros', color: 'bg-slate-100 text-slate-700' },
]

export default function DocumentosPanel({ operarios }: { operarios: { id: string; nombre: string }[] }) {
  const [opId, setOpId] = useState(operarios[0]?.id ?? '')
  const [docs, setDocs] = useState<DocumentoOperario[]>([])
  const [categoria, setCategoria] = useState<CategoriaDoc>('nomina')
  const [fechaDoc, setFechaDoc] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function cargar() {
    if (!opId) return
    const r = await accionListarDocumentos(opId)
    if (r.ok) setDocs(r.data)
  }
  useEffect(() => { cargar() }, [opId])

  async function subir(file: File) {
    if (!opId || !file) return
    setSubiendo(true)
    try {
      const supabase = createClient()
      const path = `${opId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const up = await supabase.storage.from('documentos-operarios').upload(path, file, {
        cacheControl: '3600', upsert: false,
      })
      if (up.error) {
        alert('Error subiendo: ' + up.error.message)
        return
      }
      const r = await accionRegistrarDocumento({
        operario_id: opId,
        categoria,
        nombre: file.name,
        storage_path: path,
        mime_type: file.type || null,
        tamano_bytes: file.size,
        fecha_documento: fechaDoc || null,
      })
      if (r.ok) {
        setFechaDoc('')
        if (fileRef.current) fileRef.current.value = ''
        cargar()
      }
    } finally {
      setSubiendo(false)
    }
  }

  async function descargar(doc: DocumentoOperario) {
    const r = await accionUrlFirmada(doc.storage_path)
    if (r.ok && r.data) {
      window.open(r.data, '_blank')
    } else {
      alert('No se pudo generar el enlace')
    }
  }

  async function quitar(id: string) {
    if (!confirm('¿Eliminar documento?')) return
    const r = await accionEliminarDocumento(id)
    if (r.ok) cargar()
  }

  const cat = (v: CategoriaDoc) => CATEGORIAS.find(c => c.v === v) ?? CATEGORIAS[CATEGORIAS.length - 1]
  const fmtBytes = (n: number | null) => n == null ? '—' : (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos del operario</CardTitle>
          <CardDescription>
            Sube nóminas, justificantes médicos, contratos, tickets y otros documentos. Almacenados en Supabase Storage privado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Operario</Label>
              <Select value={opId} onValueChange={setOpId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={v => setCategoria(v as CategoriaDoc)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha doc.</Label>
              <Input type="date" value={fechaDoc} onChange={e => setFechaDoc(e.target.value)} />
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={subiendo} className="w-full">
                <Upload className="h-4 w-4 mr-1" />
                {subiendo ? 'Subiendo…' : 'Subir archivo'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Archivos subidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha doc.</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Subido</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(d => {
                const c = cat(d.categoria)
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nombre}</TableCell>
                    <TableCell><Badge variant="outline" className={c.color}>{c.l}</Badge></TableCell>
                    <TableCell className="text-xs">{d.fecha_documento ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtBytes(d.tamano_bytes)}</TableCell>
                    <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString('es-ES')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => descargar(d)} title="Descargar">
                          <Download className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => quitar(d.id)} title="Eliminar">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {docs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Sin documentos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
