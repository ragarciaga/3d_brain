import bpy, bmesh, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1], load_ui=False, use_scripts=False)
dg=bpy.context.evaluated_depsgraph_get()
def wbb(o):
    e=o.evaluated_get(dg); m=e.to_mesh(); zs=[(o.matrix_world@v.co).z for v in m.vertices]; e.to_mesh_clear(); return (round(min(zs),3),round(max(zs),3)) if zs else None
names=["Hippocampus.l","Amygdaloid body.l","Thalamus.l","Hypothalamus","Caudate nucleus.l","Putamen.l","Precentral gyrus.l","Superior frontal gyrus.l","Insula (Subcentral gyrus and ant. and post. sulci*).l","Lateral ventricle.l","Nucleus of solitary tract.l","Medulla oblongata.l","Pons.l","Cerebellum.j"]
tris=0
for n in names:
    o=bpy.data.objects.get(n)
    if not o: print(n,"NO EXISTE"); continue
    e=o.evaluated_get(dg); m=e.to_mesh(); bm=bmesh.new(); bm.from_mesh(m)
    nm=sum(1 for ed in bm.edges if not ed.is_manifold); bd=sum(1 for ed in bm.edges if ed.is_boundary); t=sum(len(p.vertices)-2 for p in m.polygons); tris+=t
    chain=[]; p=o.parent
    while p: chain.append(p.name); p=p.parent
    print(f"{n}: tris={t} bordes_abiertos={bd} no_manifold={nm} padres={' > '.join(chain[:6])}")
    bm.free(); e.to_mesh_clear()
for n in ["Vagus nerve (X).l","Vagus nerve (X).r","Stomach","Oesophagus","Trachea","Left ventricle"]:
    o=bpy.data.objects.get(n); print(n,"z(min,max)=",wbb(o) if o else "NO")
for o in bpy.data.objects:
    if 'arch of aorta' in o.name.lower() or o.name.lower().startswith('aortic arch'): print(o.name, o.type)
