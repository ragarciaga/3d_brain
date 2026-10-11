import bpy, sys
out = sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+2], load_ui=False, use_scripts=False)
with open(out,'w',encoding='utf-8') as f:
    f.write("name\ttype\tcollections\tparent\tverts\tmods\tloc\trot\tscale\n")
    for o in bpy.data.objects:
        v = len(o.data.vertices) if o.type=='MESH' else (sum(len(s.points)+len(s.bezier_points) for s in o.data.splines) if o.type=='CURVE' else 0)
        cols = "|".join(c.name for c in o.users_collection)
        mods = ",".join(m.type for m in getattr(o,'modifiers',[]))
        f.write(f"{o.name}\t{o.type}\t{cols}\t{o.parent.name if o.parent else ''}\t{v}\t{mods}\t{tuple(round(x,3) for x in o.location)}\t{tuple(round(x,3) for x in o.rotation_euler)}\t{tuple(round(x,3) for x in o.scale)}\n")
print("objects", len(bpy.data.objects))
