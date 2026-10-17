using System.Collections.Generic;
using System.Linq;

namespace LanguageCore.SyntaxGenerator;

static class VibrissaIL
{
    public static SyntaxFile Generate()
    {
        Dictionary<string, Pattern> repository = [];

        string builtinTypes = string.Join('|', TypeKeywords.List);
        string keywords = string.Join('|', LanguageConstants.KeywordList);
        string typeExcludedKeywords = string.Join('|', LanguageConstants.KeywordList.Except(TypeKeywords.List));
        string anyIdentifier = @$"[a-zA-Z_@]+[a-zA-Z0-9_@]*";
        string identifier = @$"(?!(?:{keywords})\b){anyIdentifier}";
        string typeRegex = @$"(?!(?:{typeExcludedKeywords})\b)([a-zA-Z_@]+[a-zA-Z0-9_@\*\[\]]*)|([a-zA-Z_@]+[a-zA-Z0-9_@\*\[\]]*\<[\w,\s]*\>)";

        repository["label"] = new Pattern()
        {
            Match = "([a-zA-Z][a-zA-Z0-9]*)(:)",
            Captures = new()
            {
                { 1, new(Name.EntityNameFunction) },
                { 2, new(Name.Punctuation) },
            }
        };

        repository["instruction"] = new Pattern()
        {
            Match = @"^\s*([0-9]+:)[ \t]+([a-zA-Z0-9]+)[ \t]*([a-zA-Z0-9\[\] \<\>\+\-]*)",
            Captures = new()
            {
                { 1, new(Name.Comment) },
                { 2, new(Name.EntityNameFunction) },
                { 3, Match.Includes("#operand") },
            }
        };

        repository["operand"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = "(\\<{1,2})([a-zA-Z0-9]+)(\\>{1,2})",
                    Captures = new()
                    {
                        { 1, new(Name.Punctuation) },
                        { 2, new(Name.EntityNameFunction) },
                        { 3, new(Name.Punctuation) },
                    },
                },
                new()
                {
                    Match = "\\b(BYTE|WORD|DWORD|QWORD)\\b",
                    Captures = new()
                    {
                        { 1, new(Name.EntityNameType) },
                    },
                },
                new()
                {
                    Match = "\\b(RCP|RSP|RBP|RAX|EAX|AX|AH|AL|RBX|EBX|BX|BH|BL|ECX|RCX|CX|CH|CL|RDX|EDX|DX|DH|DL|BP|SP)\\b",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                    },
                },
                new()
                {
                    Match = "\\b([0-9]+)\\b",
                    Captures = new()
                    {
                        { 1, new(Name.ConstantNumeric) },
                    }
                },
                new()
                {
                    Match = "(#)([a-zA-Z0-9_]+)\\b",
                    Captures = new()
                    {
                        { 1, new(Name.Punctuation) },
                        { 2, new(Name.VariableName) },
                    },
                },
                new()
                {
                    Match = "(\\[|\\]|\\+|\\-)",
                    Captures = new()
                    {
                        { 1, new(Name.Punctuation) },
                    },
                },
            ],
        };

        repository["comment"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = "^.*$",
                    Name = Name.CommentLine,
                },
            ],
        };

        return new SyntaxFile()
        {
            Schema = "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
            Name = "Vibrissa IL",
            FileTypes = ["bbil"],
            ScopeName = "source.bbil",
            Repository = repository,
            Patterns = [
                new() { Include = "#label" },
                new() { Include = "#instruction" },
                new() { Include = "#comment" },
            ]
        };
    }
}
