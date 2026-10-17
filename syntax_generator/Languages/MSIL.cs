using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;

namespace LanguageCore.SyntaxGenerator;

static class MSIL
{
    public static SyntaxFile Generate()
    {
        ImmutableArray<string> InstructionList = [
            @"add(\.ovf(\.un)?)?",
            @"and",
            @"arglist",
            @"beq(\.s)?",
            @"bge(\.un)?(\.s)?",
            @"bgt(\.un)?(\.s)?",
            @"ble(\.un)?(\.s)?",
            @"blt(\.un)?(\.s)?",
            @"bne.un(\.s)?",
            @"box",
            @"br(\.s)?",
            @"break",
            @"brfalse(\.s)?",
            @"brinst(\.s)?",
            @"brnull(\.s)?",
            @"brtrue(\.s)?",
            @"brzero(\.s)?",
            @"call",
            @"calli",
            @"callvirt",
            @"castclass",
            @"ceq",
            @"cgt(\.un)?",
            @"ckfinite",
            @"clt(\.un)?",
            @"constrained.",
            @"conv.i",
            @"conv.i1",
            @"conv.i2",
            @"conv.i4",
            @"conv.i8",
            @"conv.ovf.i",
            @"conv.ovf.i.un",
            @"conv.ovf.i1",
            @"conv.ovf.i1.un",
            @"conv.ovf.i2",
            @"conv.ovf.i2.un",
            @"conv.ovf.i4",
            @"conv.ovf.i4.un",
            @"conv.ovf.i8",
            @"conv.ovf.i8.un",
            @"conv.ovf.u",
            @"conv.ovf.u.un",
            @"conv.ovf.u1",
            @"conv.ovf.u1.un",
            @"conv.ovf.u2",
            @"conv.ovf.u2.un",
            @"conv.ovf.u4",
            @"conv.ovf.u4.un",
            @"conv.ovf.u8",
            @"conv.ovf.u8.un",
            @"conv.r.un",
            @"conv.r4",
            @"conv.r8",
            @"conv.u",
            @"conv.u1",
            @"conv.u2",
            @"conv.u4",
            @"conv.u8",
            @"cpblk",
            @"cpobj",
            @"div(\.un)?",
            @"dup",
            @"endfault",
            @"endfilter",
            @"endfinally",
            @"initblk",
            @"initobj",
            @"isinst",
            @"jmp",
            @"ldarg(\.[0123s])?",
            @"ldarga(\.s)?",
            @"ldc.i4",
            @"ldc.i4.0",
            @"ldc.i4.1",
            @"ldc.i4.2",
            @"ldc.i4.3",
            @"ldc.i4.4",
            @"ldc.i4.5",
            @"ldc.i4.6",
            @"ldc.i4.7",
            @"ldc.i4.8",
            @"ldc.i4.m1",
            @"ldc.i4.M1",
            @"ldc.i4.s",
            @"ldc.i8",
            @"ldc.r4",
            @"ldc.r8",
            @"ldelem",
            @"ldelem.i",
            @"ldelem.i1",
            @"ldelem.i2",
            @"ldelem.i4",
            @"ldelem.i8",
            @"ldelem.r4",
            @"ldelem.r8",
            @"ldelem.ref",
            @"ldelem.u1",
            @"ldelem.u2",
            @"ldelem.u4",
            @"ldelem.u8",
            @"ldelema",
            @"ldfld",
            @"ldflda",
            @"ldftn",
            @"ldind.i",
            @"ldind.i1",
            @"ldind.i2",
            @"ldind.i4",
            @"ldind.i8",
            @"ldind.r4",
            @"ldind.r8",
            @"ldind.ref",
            @"ldind.u1",
            @"ldind.u2",
            @"ldind.u4",
            @"ldind.u8",
            @"ldlen",
            @"ldloc(\.[0123s])?",
            @"ldloca(\.s)?",
            @"ldnull",
            @"ldobj",
            @"ldsfld",
            @"ldsflda",
            @"ldstr",
            @"ldtoken",
            @"ldvirtftn",
            @"leave(\.s)?",
            @"localloc",
            @"mkrefany",
            @"mul(\.ovf(\.un)?)?",
            @"neg",
            @"newarr",
            @"newobj",
            @"nop",
            @"not",
            @"or",
            @"pop",
            @"refanytype",
            @"refanyval",
            @"rem(\.un)?",
            @"ret",
            @"rethrow",
            @"shl",
            @"shr(\.un)?",
            @"sizeof",
            @"starg(\.s)?",
            @"stelem",
            @"stelem.i",
            @"stelem.i1",
            @"stelem.i2",
            @"stelem.i4",
            @"stelem.i8",
            @"stelem.r4",
            @"stelem.r8",
            @"stelem.ref",
            @"stfld",
            @"stind.i",
            @"stind.i1",
            @"stind.i2",
            @"stind.i4",
            @"stind.i8",
            @"stind.r4",
            @"stind.r8",
            @"stind.ref",
            @"stloc(\.[0123s])?",
            @"stobj",
            @"stsfld",
            @"sub(\.ovf(\.un)?)?",
            @"throw",
            @"unbox(\.any)?",
            @"xor",
        ];

        ImmutableArray<string> Attributes = [..
            Enum.GetNames<MethodAttributes>()
            .Append(Enum.GetNames<TypeAttributes>())
            .Append(Enum.GetNames<FieldAttributes>())
            .Append(Enum.GetNames<MethodAttributes>())
            .Distinct()
        ];

        OpCode[] opCodes = [
            OpCodes.Nop,
            OpCodes.Break,
            OpCodes.Ldarg_0,
            OpCodes.Ldarg_1,
            OpCodes.Ldarg_2,
            OpCodes.Ldarg_3,
            OpCodes.Ldloc_0,
            OpCodes.Ldloc_1,
            OpCodes.Ldloc_2,
            OpCodes.Ldloc_3,
            OpCodes.Stloc_0,
            OpCodes.Stloc_1,
            OpCodes.Stloc_2,
            OpCodes.Stloc_3,
            OpCodes.Ldarg_S,
            OpCodes.Ldarga_S,
            OpCodes.Starg_S,
            OpCodes.Ldloc_S,
            OpCodes.Ldloca_S,
            OpCodes.Stloc_S,
            OpCodes.Ldnull,
            OpCodes.Ldc_I4_M1,
            OpCodes.Ldc_I4_0,
            OpCodes.Ldc_I4_1,
            OpCodes.Ldc_I4_2,
            OpCodes.Ldc_I4_3,
            OpCodes.Ldc_I4_4,
            OpCodes.Ldc_I4_5,
            OpCodes.Ldc_I4_6,
            OpCodes.Ldc_I4_7,
            OpCodes.Ldc_I4_8,
            OpCodes.Ldc_I4_S,
            OpCodes.Ldc_I4,
            OpCodes.Ldc_I8,
            OpCodes.Ldc_R4,
            OpCodes.Ldc_R8,
            OpCodes.Dup,
            OpCodes.Pop,
            OpCodes.Jmp,
            OpCodes.Call,
            OpCodes.Calli,
            OpCodes.Ret,
            OpCodes.Br_S,
            OpCodes.Brfalse_S,
            OpCodes.Brtrue_S,
            OpCodes.Beq_S,
            OpCodes.Bge_S,
            OpCodes.Bgt_S,
            OpCodes.Ble_S,
            OpCodes.Blt_S,
            OpCodes.Bne_Un_S,
            OpCodes.Bge_Un_S,
            OpCodes.Bgt_Un_S,
            OpCodes.Ble_Un_S,
            OpCodes.Blt_Un_S,
            OpCodes.Br,
            OpCodes.Brfalse,
            OpCodes.Brtrue,
            OpCodes.Beq,
            OpCodes.Bge,
            OpCodes.Bgt,
            OpCodes.Ble,
            OpCodes.Blt,
            OpCodes.Bne_Un,
            OpCodes.Bge_Un,
            OpCodes.Bgt_Un,
            OpCodes.Ble_Un,
            OpCodes.Blt_Un,
            OpCodes.Switch,
            OpCodes.Ldind_I1,
            OpCodes.Ldind_U1,
            OpCodes.Ldind_I2,
            OpCodes.Ldind_U2,
            OpCodes.Ldind_I4,
            OpCodes.Ldind_U4,
            OpCodes.Ldind_I8,
            OpCodes.Ldind_I,
            OpCodes.Ldind_R4,
            OpCodes.Ldind_R8,
            OpCodes.Ldind_Ref,
            OpCodes.Stind_Ref,
            OpCodes.Stind_I1,
            OpCodes.Stind_I2,
            OpCodes.Stind_I4,
            OpCodes.Stind_I8,
            OpCodes.Stind_R4,
            OpCodes.Stind_R8,
            OpCodes.Add,
            OpCodes.Sub,
            OpCodes.Mul,
            OpCodes.Div,
            OpCodes.Div_Un,
            OpCodes.Rem,
            OpCodes.Rem_Un,
            OpCodes.And,
            OpCodes.Or,
            OpCodes.Xor,
            OpCodes.Shl,
            OpCodes.Shr,
            OpCodes.Shr_Un,
            OpCodes.Neg,
            OpCodes.Not,
            OpCodes.Conv_I1,
            OpCodes.Conv_I2,
            OpCodes.Conv_I4,
            OpCodes.Conv_I8,
            OpCodes.Conv_R4,
            OpCodes.Conv_R8,
            OpCodes.Conv_U4,
            OpCodes.Conv_U8,
            OpCodes.Callvirt,
            OpCodes.Cpobj,
            OpCodes.Ldobj,
            OpCodes.Ldstr,
            OpCodes.Newobj,
            OpCodes.Castclass,
            OpCodes.Isinst,
            OpCodes.Conv_R_Un,
            OpCodes.Unbox,
            OpCodes.Throw,
            OpCodes.Ldfld,
            OpCodes.Ldflda,
            OpCodes.Stfld,
            OpCodes.Ldsfld,
            OpCodes.Ldsflda,
            OpCodes.Stsfld,
            OpCodes.Stobj,
            OpCodes.Conv_Ovf_I1_Un,
            OpCodes.Conv_Ovf_I2_Un,
            OpCodes.Conv_Ovf_I4_Un,
            OpCodes.Conv_Ovf_I8_Un,
            OpCodes.Conv_Ovf_U1_Un,
            OpCodes.Conv_Ovf_U2_Un,
            OpCodes.Conv_Ovf_U4_Un,
            OpCodes.Conv_Ovf_U8_Un,
            OpCodes.Conv_Ovf_I_Un,
            OpCodes.Conv_Ovf_U_Un,
            OpCodes.Box,
            OpCodes.Newarr,
            OpCodes.Ldlen,
            OpCodes.Ldelema,
            OpCodes.Ldelem_I1,
            OpCodes.Ldelem_U1,
            OpCodes.Ldelem_I2,
            OpCodes.Ldelem_U2,
            OpCodes.Ldelem_I4,
            OpCodes.Ldelem_U4,
            OpCodes.Ldelem_I8,
            OpCodes.Ldelem_I,
            OpCodes.Ldelem_R4,
            OpCodes.Ldelem_R8,
            OpCodes.Ldelem_Ref,
            OpCodes.Stelem_I,
            OpCodes.Stelem_I1,
            OpCodes.Stelem_I2,
            OpCodes.Stelem_I4,
            OpCodes.Stelem_I8,
            OpCodes.Stelem_R4,
            OpCodes.Stelem_R8,
            OpCodes.Stelem_Ref,
            OpCodes.Ldelem,
            OpCodes.Stelem,
            OpCodes.Unbox_Any,
            OpCodes.Conv_Ovf_I1,
            OpCodes.Conv_Ovf_U1,
            OpCodes.Conv_Ovf_I2,
            OpCodes.Conv_Ovf_U2,
            OpCodes.Conv_Ovf_I4,
            OpCodes.Conv_Ovf_U4,
            OpCodes.Conv_Ovf_I8,
            OpCodes.Conv_Ovf_U8,
            OpCodes.Refanyval,
            OpCodes.Ckfinite,
            OpCodes.Mkrefany,
            OpCodes.Ldtoken,
            OpCodes.Conv_U2,
            OpCodes.Conv_U1,
            OpCodes.Conv_I,
            OpCodes.Conv_Ovf_I,
            OpCodes.Conv_Ovf_U,
            OpCodes.Add_Ovf,
            OpCodes.Add_Ovf_Un,
            OpCodes.Mul_Ovf,
            OpCodes.Mul_Ovf_Un,
            OpCodes.Sub_Ovf,
            OpCodes.Sub_Ovf_Un,
            OpCodes.Endfinally,
            OpCodes.Leave,
            OpCodes.Leave_S,
            OpCodes.Stind_I,
            OpCodes.Conv_U,
            OpCodes.Prefix7,
            OpCodes.Prefix6,
            OpCodes.Prefix5,
            OpCodes.Prefix4,
            OpCodes.Prefix3,
            OpCodes.Prefix2,
            OpCodes.Prefix1,
            OpCodes.Prefixref,
            OpCodes.Arglist,
            OpCodes.Ceq,
            OpCodes.Cgt,
            OpCodes.Cgt_Un,
            OpCodes.Clt,
            OpCodes.Clt_Un,
            OpCodes.Ldftn,
            OpCodes.Ldvirtftn,
            OpCodes.Ldarg,
            OpCodes.Ldarga,
            OpCodes.Starg,
            OpCodes.Ldloc,
            OpCodes.Ldloca,
            OpCodes.Stloc,
            OpCodes.Localloc,
            OpCodes.Endfilter,
            OpCodes.Unaligned,
            OpCodes.Volatile,
            OpCodes.Tailcall,
            OpCodes.Initobj,
            OpCodes.Constrained,
            OpCodes.Cpblk,
            OpCodes.Initblk,
            OpCodes.Rethrow,
            OpCodes.Sizeof,
            OpCodes.Refanytype,
            OpCodes.Readonly,
        ];

        string IdentifierMatch = @"[a-zA-Z_@][a-zA-Z0-9_@]*";
        string TypeMatch = @"[a-zA-Z_@][a-zA-Z0-9_@\.\[\]&\*\+`]*";
        string AttributesMatch = @$"({string.Join('|', Attributes.Select(v => $"{v} "))})*";
        string GetAttributesMatch<T>() where T : struct, Enum => @$"({string.Join('|', Enum.GetNames<T>().Select(v => @$"{v}\s+"))})*"; ;

        Dictionary<string, Pattern> repository = [];

        repository["attributes"] = new Pattern()
        {
            Match = $@"({string.Join('|', Attributes)})",
            Captures = new()
            {
                { 1, new(Name.Keyword) }
            }
        };

        repository["type"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = @"\b(void|bool|byte|sbyte|char|decimal|double|float|int|uint|nint|nuint|long|ulong|short|ushort|object|string|dynamic)\b",
                    Name = Name.Keyword,
                },
                new()
                {
                    Match = $@"([a-zA-Z_@][a-zA-Z0-9_@\.]*\.)?({IdentifierMatch})",
                    Captures = new()
                    {
                        { 1, new(Name.Punctuation) },
                        { 2, new(Name.EntityNameType) },
                    },
                },
                new()
                {
                    Match = @"\[|\]|\*|\&|\+|`",
                    Name = Name.Punctuation,
                },
                new()
                {
                    Match = @"\b\d+\b",
                    Name = Name.Punctuation,
                },
            ]
        };

        repository["scope"] = new Pattern()
        {
            Begin = "{",
            End = "}",

            BeginCaptures = new()
            {
                { 0, new(Name.Punctuation) },
            },

            EndCaptures = new()
            {
                { 0, new(Name.Punctuation) },
            },

            Patterns = [
                new() { Include = "#maxstack" },
                new() { Include = "#locals" },
                new() { Include = "#instruction" },
                new() { Include = "#function-definition" },
                new() { Include = "#constructor-definition" },
                new() { Include = "#field-definition" },

                new() { Include = "#custom-attribute" },
                new() { Include = "#punctuation" },
            ],
        };

        repository["field-definition"] = new Pattern()
        {
            Match = @$"^[ \t]*({GetAttributesMatch<FieldAttributes>()})({TypeMatch}) ({IdentifierMatch})",
            Captures = new()
            {
                { 1, new() { Patterns = [ new() { Include = "#attributes" } ] } },
                { 3, Match.Includes("#type") },
                { 4, new(Name.VariableOther) },
            },
        };

        repository["constructor-definition"] = new Pattern()
        {
            Match = @$"^[ \t]*({GetAttributesMatch<MethodAttributes>()})(\.ctor)\((.*)\)",
            Captures = new()
            {
                { 1, new() { Patterns = [ new() { Include = "#attributes" } ] } },
                { 3, new(Name.Keyword) },
                { 4, new()
                {
                    Patterns = [
                        new()
                        {
                            Match = $@"({TypeMatch}) ({IdentifierMatch})",
                            Captures = new()
                            {
                                { 1, Match.Includes("#type") },
                                { 2, new(Name.VariableParameter) },
                            }
                        }
                    ]
                } },
            },
        };

        repository["function-definition"] = new Pattern()
        {
            Match = @$"^[ \t]*({GetAttributesMatch<MethodAttributes>()})({TypeMatch}) ({IdentifierMatch})\((.*)\)",
            Captures = new()
            {
                { 1, new() { Patterns = [ new() { Include = "#attributes" } ] } },
                { 3, Match.Includes("#type") },
                { 4, new(Name.EntityNameFunction) },
                { 5, new()
                {
                    Patterns = [
                        new()
                        {
                            Match = $@"({TypeMatch}) ({IdentifierMatch})",
                            Captures = new()
                            {
                                { 1, Match.Includes("#type") },
                                { 2, new(Name.VariableParameter) },
                            }
                        }
                    ]
                } },
            },
        };

        repository["type-definition"] = new Pattern()
        {
            Match = @$"^[ \t]*({GetAttributesMatch<TypeAttributes>()})({IdentifierMatch})(\s*:\s*({TypeMatch}))?\n",
            Captures = new()
            {
                { 1, new() { Patterns = [ new() { Include = "#attributes" } ] } },
                { 3, Match.Includes("#type") },
                { 5, Match.Includes("#type") },
            },
        };

        repository["custom-attribute"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = @$"\[([a-zA-Z0-9\.]+\.)?([a-zA-Z0-9]+)\((.*)\)\]",
                    Captures = new()
                    {
                        { 1, new(Name.Punctuation) },
                        { 2, new(Name.EntityNameType) },
                        { 3, Match.Includes("#literal") },
                    },
                    Patterns = [
                        new() { Include = "#punctuation" }
                    ],
                },
            ],
        };

        repository["maxstack"] = new Pattern()
        {
            Match = @$"(\.maxstack)\s+([0-9]+)",
            Captures = new()
            {
                { 1, new(Name.Keyword) },
                { 2, new(Name.ConstantNumeric) },
            }
        };

        repository["locals"] = new Pattern()
        {
            Begin = @$"(\.locals)\b\s*(\()",
            BeginCaptures = new()
            {
                { 1, new(Name.Keyword) },
                { 2, new(Name.Punctuation) }
            },
            End = @$"(\))",
            EndCaptures = new()
            {
                { 1, new(Name.Punctuation) }
            },
            Patterns = [
                new()
                {
                    Match = @$"({TypeMatch})\s+({IdentifierMatch})",
                    Captures = new()
                    {
                        { 1, Match.Includes("#type") },
                        { 2, new(Name.EntityNameVariable) },
                    }
                }
            ],
        };

        repository["instruction"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = @$"\b({string.Join('|', [OpCodes.Starg, OpCodes.Starg_S, OpCodes.Ldarg, OpCodes.Ldarga, OpCodes.Ldarga_S])})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new(Name.VariableParameter) },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineNone).Select(v => v.Name))})",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineI or OperandType.InlineI8 or OperandType.InlineR or OperandType.InlineString or OperandType.ShortInlineI or OperandType.ShortInlineR).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, Match.Includes("#number") },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineBrTarget or OperandType.ShortInlineBrTarget).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new(Name.VariableOther) },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineField).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new() { Patterns = [
                            new()
                            {
                                Match = @$"({TypeMatch}) ({TypeMatch})(\.)({IdentifierMatch})",
                                Captures = new()
                                {
                                    { 1, Match.Includes("#type") },
                                    { 2, Match.Includes("#type") },
                                    { 3, new(Name.Punctuation) },
                                    { 4, new(Name.VariableOther) },
                                }
                            }
                        ] } },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineMethod).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new() { Patterns = [
                            new()
                            {
                                Match = @$"({TypeMatch}) ({IdentifierMatch})(\[({TypeMatch}[, ]{{0,2}})+\])?\((.*)\)((\/)({TypeMatch}))?",
                                Captures = new()
                                {
                                    { 1, Match.Includes("#type") },
                                    { 2, new(Name.EntityNameFunction) },
                                    { 3, Match.Includes("#type") },
                                    { 5, Match.Includes("#type") },
                                    { 7, new(Name.Punctuation) },
                                    { 8, Match.Includes("#type") },
                                }
                            },
                            new()
                            {
                                Match = @$"({TypeMatch}) (\.ctor)\((.*)\)((\/)({TypeMatch}))?",
                                Captures = new()
                                {
                                    { 1, Match.Includes("#type") },
                                    { 2, new(Name.KeywordOther) },
                                    { 3, Match.Includes("#type") },
                                    { 5, new(Name.Punctuation) },
                                    { 6, Match.Includes("#type") },
                                }
                            }
                        ] } },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineSig).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineString).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, Match.Includes("#string") },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineSwitch).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineTok).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineType).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, Match.Includes("#type") },
                    },
                },
                new()
                {
                    Match = @$"\b({string.Join('|', opCodes.Where(v => v.OperandType is OperandType.InlineVar or OperandType.ShortInlineVar).Select(v => v.Name))})\s+(.+)",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new(Name.EntityNameVariable) },
                    },
                },
            ],
        };

        repository["literal"] = new Pattern()
        {
            Patterns =
            [
                new() { Include = "#string" },
                new() { Include = "#number" },
            ]
        };

        repository["comment"] = new Pattern()
        {
            Match = @"\/\/[^\n]*\n",
            Name = Name.CommentLineDoubleSlash
        };

        repository["comment-block"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Begin = @"/\*",
                    End = @"\*/",
                    Name = Name.CommentBlock,

                    BeginCaptures = new()
                    {
                        { 0, new(Name.Punctuation["definition.comment.begin"]) }
                    },
                    EndCaptures = new()
                    {
                        { 0, new(Name.Punctuation["definition.comment.end"]) },
                    }
                },
                new()
                {
                    Match = @"\*/.*\n",
                    Name = Name.InvalidIllegal["stray-comment-end"]
                }
            ]
        };

        repository["number"] = new Pattern()
        {
            Match = @"\.[0-9]+f?\b|\b[0-9]+f?\b|\b0x[0-9a-fA-F_]+\b|\b0b[01_]+\b|\b[0-9]e[0-9]f?\b",
            Name = "constant.numeric"
        };

        repository["string"] = new Pattern()
        {
            Begin = "\"",
            End = "\"",
            Name = Name.StringQuotedDouble,
            Patterns =
            [
                new() { Include = "#string-escaped-char" }
            ]
        };

        repository["string-escaped-char"] = new Pattern()
        {
            Patterns =
            [
                new()
                {
                    Match = @"(?x)\\(\\|[ntr\""e]|0|(u[0-9a-fA-F]{4}))",
                    Name = Name.ConstantCharacterEscape
                },
                new()
                {
                    Match = @"\\(u[0-9a-zA-Z]{4}|.)",
                    Name = Name.InvalidIllegal["unknown-escape"]
                }
            ]
        };

        repository["punctuation"] = new Pattern()
        {
            Match = @$"(;|,)",
            Captures = new()
            {
                { 1, new(Name.Punctuation) },
            }
        };

        return new SyntaxFile()
        {
            Schema = "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
            Name = "MSIL",
            FileTypes = ["il", "msil"],
            ScopeName = "source.il",
            Repository = repository,
            Patterns = [
                new() { Include = "#comment" },
                new() { Include = "#comment-block" },
                new() { Include = "#function-definition" },
                new() { Include = "#type-definition" },
                new() { Include = "#scope" },

                new() { Include = "#custom-attribute" },
                new() { Include = "#punctuation" },
            ]
        };
    }
}
