import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1], load_ui=False, use_scripts=False)
for n in ["Vagus nerve (X).l","Vagus nerve (X).r","Glossopharyngeal nerve (IX).l"]:
    o=bpy.data.objects[n]; c=o.data
    print(n, "splines", len(c.splines), "bevel_depth", round(c.bevel_depth,4), "bevel_obj", c.bevel_object, "res", c.bevel_resolution, "children", [ch.name for ch in o.children][:20])
    for i,s in enumerate(c.splines):
        pts=[p.co for p in (s.bezier_points if s.type=='BEZIER' else s.points)]
        mw=o.matrix_world
        a=mw @ pts[0].xyz; b=mw @ pts[-1].xyz
        print("  spline",i,s.type,len(pts),"z from",round(a.z,3),"to",round(b.z,3))
dg=bpy.context.evaluated_depsgraph_get()
o=bpy.data.objects["Vagus nerve (X).r"].evaluated_get(dg); m=o.to_mesh(); print("evaluated mesh verts", len(m.vertices), "tris approx", sum(len(p.vertices)-2 for p in m.polygons))
print("unit scale", bpy.context.scene.unit_settings.scale_length, bpy.context.scene.unit_settings.system)
