import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1], load_ui=False, use_scripts=False)
dg=bpy.context.evaluated_depsgraph_get()
tot=0; n=0; withmods=0; nonid=0; parented=0; curves=0
for o in bpy.data.objects:
    cols=[c.name for c in o.users_collection]
    if o.type not in ('MESH','CURVE') or not any(c.startswith('7:') for c in cols) or o.name.endswith(('.j','.t','.g')): continue
    n+=1; curves += o.type=='CURVE'
    if len(o.modifiers): withmods+=1
    if o.parent: parented+=1
    if any(abs(x)>1e-6 for x in o.location) or any(abs(x)>1e-6 for x in o.rotation_euler) or any(abs(x-1)>1e-6 for x in o.scale): nonid+=1
    try:
        m=o.evaluated_get(dg).to_mesh(); tot+=sum(len(p.vertices)-2 for p in m.polygons); o.evaluated_get(dg).to_mesh_clear()
    except Exception as e: pass
print("nervous objs",n,"curves",curves,"with modifiers",withmods,"parented",parented,"non-identity transform",nonid,"triangles",tot)
