using System.Reflection;
using HarmonyLib;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Helpers;

namespace Sts2.NativeSim.FullAppBridge;

public static class PresentationSuppression
{
    private static bool _applied;

    public static void Apply(Harmony harmony)
    {
        if (_applied) return;
        _applied = true;

        NonInteractiveMode.AutoSlayerCheck = () => true;

        // spire-jev: a game on screen, played for a recording (SPIRE_JEV_VISUAL=1), keeps its
        // animations, effects and sounds; the Punch Off's loop waits on real animations there.
        if (System.Environment.GetEnvironmentVariable("SPIRE_JEV_VISUAL") == "1")
        {
            Godot.GD.Print("[spire-jev] visual: presentation left on");
            return;
        }

        // Strictly patch leaf presentation sinks (audio, visual effects, speech bubbles, camera animations)
        TryPatchAllMethods(harmony, typeof(MegaCrit.Sts2.Core.Commands.VfxCmd));
        TryPatchAllMethods(harmony, typeof(MegaCrit.Sts2.Core.Audio.Debug.NDebugAudioManager));
        TryPatchAllMethods(harmony, typeof(MegaCrit.Sts2.Core.Commands.SfxCmd));
        TryPatchAllMethods(harmony, typeof(MegaCrit.Sts2.Core.Commands.ThinkCmd));

        TryPatchVoid(harmony, typeof(CreatureCmd), "TriggerAnim");
        TryPatchVoid(harmony, typeof(MegaCrit.Sts2.Core.Nodes.Screens.Map.NNormalMapPoint), "SetAngle");
        // spire-jev: the Punch Off event's two fighters trade punches on screen until an option is
        // chosen; with their animations gone every wait in that loop finishes at once, and it spun
        // the main thread forever (seeds 17, 20, 27 froze on entering it, the log's last line
        // "Creating NCombatRoom with mode=VisualOnly encounter=PUNCH_OFF_EVENT_ENCOUNTER").
        TryPatchSkipTask(harmony, typeof(MegaCrit.Sts2.Core.Models.Events.PunchOff), "PunchEachOther");

        try
        {
            MethodInfo? execute = AccessTools.Method(typeof(MegaCrit.Sts2.Core.Commands.Builders.AttackCommand), "Execute");
            if (execute is not null)
            {
                harmony.Patch(execute, prefix: new HarmonyMethod(typeof(PresentationSuppression), nameof(SuppressAttackCommandVfx)));
            }

            MethodInfo? addChild = AccessTools.Method(typeof(GodotTreeExtensions), "AddChildSafely");
            if (addChild is not null)
            {
                harmony.Patch(addChild, prefix: new HarmonyMethod(typeof(PresentationSuppression), nameof(SafeAddChild)));
            }

            MethodInfo? getVfx = AccessTools.Method(typeof(MegaCrit.Sts2.Core.Entities.Creatures.Creature), "GetVfxContainer");
            if (getVfx is not null)
            {
                harmony.Patch(getVfx, prefix: new HarmonyMethod(typeof(PresentationSuppression), nameof(GetVfxContainerPrefix)));
            }
        }
        catch
        {
            // Ignored
        }
    }

    private static bool GetVfxContainerPrefix(ref Godot.Control __result)
    {
        __result = new Godot.Control();
        return false;
    }

    private static void SuppressAttackCommandVfx(MegaCrit.Sts2.Core.Commands.Builders.AttackCommand __instance)
    {
        try
        {
            var f1 = AccessTools.Field(typeof(MegaCrit.Sts2.Core.Commands.Builders.AttackCommand), "_customHitVfxNodes");
            if (f1?.GetValue(__instance) is System.Collections.IList list1) list1.Clear();
            var f2 = AccessTools.Field(typeof(MegaCrit.Sts2.Core.Commands.Builders.AttackCommand), "_customAttackerVfxNodes");
            if (f2?.GetValue(__instance) is System.Collections.IList list2) list2.Clear();
        }
        catch { }
    }

    private static bool SafeAddChild(Godot.Node? parent, Godot.Node? child)
    {
        if (parent is null || child is null) return false;
        return true;
    }

    private static void TryPatchAllMethods(Harmony harmony, Type type)
    {
        try
        {
            foreach (MethodInfo method in type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                if (method.ReturnType == typeof(void))
                {
                    harmony.Patch(method, prefix: new HarmonyMethod(typeof(PresentationSuppression), nameof(SkipVoidMethod)));
                }
            }
        }
        catch { }
    }

    private static void TryPatchVoid(Harmony harmony, Type type, string methodName)
    {
        try
        {
            foreach (MethodInfo method in type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                if (method.Name == methodName && method.ReturnType == typeof(void))
                {
                    harmony.Patch(method, prefix: new HarmonyMethod(typeof(PresentationSuppression), nameof(SkipVoidMethod)));
                }
            }
        }
        catch
        {
            // Ignored if method not present in build
        }
    }

    private static bool SkipVoidMethod()
    {
        return false;
    }

    /// <summary>A presentation coroutine (a Task) that is only shown, never waited on for its result.</summary>
    private static void TryPatchSkipTask(Harmony harmony, Type type, string methodName)
    {
        try
        {
            MethodInfo? method = AccessTools.Method(type, methodName);
            if (method is not null && method.ReturnType == typeof(Task))
            {
                harmony.Patch(method, prefix: new HarmonyMethod(typeof(PresentationSuppression), nameof(SkipTaskMethod)));
            }
            else
            {
                Godot.GD.PrintErr($"[FullAppBridge] no Task {type.Name}.{methodName} to skip");
            }
        }
        catch (Exception ex)
        {
            Godot.GD.PrintErr($"[FullAppBridge] skip {type.Name}.{methodName}: {ex.Message}");
        }
    }

    private static bool SkipTaskMethod(ref Task __result)
    {
        __result = Task.CompletedTask;
        return false;
    }
}
