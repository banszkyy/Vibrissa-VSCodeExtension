using System.Collections.Generic;
using System.Linq;

namespace LanguageCore.SyntaxGenerator;

static class Source
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

        repository["scope"] = new Pattern()
        {
            Begin = "{",
            End = "}",

            Patterns =
            [
                new() { Include = "#comment" },
                new() { Include = "#comment-block" },

                new() { Include = "#keyword" },
                new() { Include = "#operator" },
                new() { Include = "#punctuation" },

                new() { Include = "#any-statement" },
                new() { Include = "#scope" },
            ]
        };

        repository["preprocessor"] = new Pattern()
        {
            Patterns = [
                new Pattern(){
                    Match = @$"(#if)\s *({anyIdentifier})",
                    Captures = new()
                    {
                        { 1, new(Name.Comment) },
                        { 2, new(Name.Comment) },
                    },
                },
                new Pattern(){
                    Match = @$"(#else)",
                    Captures = new()
                    {
                        { 1, new(Name.Comment) },
                        { 2, new(Name.Comment) },
                    },
                },
                new Pattern(){
                    Match = @"(#endif)",
                    Captures = new()
                    {
                        { 1, new(Name.Comment) },
                    },
                }
            ]
        };

        repository["type"] = new Pattern()
        {
            Patterns = [
                new Pattern() {
                    Match = @$"\b({string.Join('|', TypeKeywords.List)})\b",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                    },
                },
                new Pattern() {
                    Match = @$"\b(\w+)\b",
                    Captures = new()
                    {
                        { 1, new(Name.EntityNameType) },
                    },
                },
                new Pattern() {
                    Match = @$"(\<|\>)",
                    Captures = new()
                    {
                        { 1, new(Name.Punctuation) },
                    }
                },
                new Pattern() { Include = "#operator" },
                new Pattern() { Include = "#punctuation" },
            ],
        };

        repository["literal"] = new Pattern()
        {
            Patterns =
            [
                new() { Include = "#strings" },
                new() { Include = "#number" },
            ]
        };

        repository["any-statement"] = new Pattern()
        {
            Patterns =
            [
                new() { Include = "#comment" },
                new() { Include = "#comment-block" },

                new() { Include = "#as" },
                new() { Include = "#flow-control-statement" },
                new() { Include = "#function-call" },
                new() { Include = "#local-definition" },
                new() { Include = "#field-access" },
                new() { Include = "#literal" },
                new() { Include = "#keyword" },
                new() { Include = "#identifier" },
            ]
        };

        repository["hover-popup"] = new Pattern()
        {
            Match = @"^\([a-z]+\)(?= )",
            Name = Name.Punctuation
        };

        repository["flow-control-statement"] = new Pattern()
        {
            Match = @$"\b({string.Join('|',
                StatementKeywords.Return,
                StatementKeywords.Crash,
                StatementKeywords.If,
                StatementKeywords.Else,
                StatementKeywords.While,
                StatementKeywords.For,
                StatementKeywords.Break)})\b",
            Captures = new()
            {
                { 1, new(Name.KeywordControl) },
            }
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
                    },

                    Patterns = [
                        new()
                        {
                            Match = @"^[ \t]*(\*)(?!/)",
                            Captures = new()
                            {
                                { 1, new(Name.Punctuation["definition.comment"]) }
                            }
                        }
                    ]
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
            Match = @"(\.[0-9]+f?\b|\b[0-9]+f?\b|\b0x[0-9a-fA-F_]+\b|\b0b[01_]+\b|\b[0-9]e[0-9]f?\b)",
            Name = Name.ConstantNumeric
        };

        repository["struct-definition"] = new Pattern()
        {
            Match = @$"({DeclarationKeywords.Struct})[\s]+({identifier})",
            Captures = new()
            {
                { 1, new(Name.Keyword) },
                { 2, new(Name.EntityNameType) },
            }
        };

        repository["alias-definition"] = new Pattern()
        {
            Match = @$"({DeclarationKeywords.Alias})\s+({identifier})\s+",
            Captures = new()
            {
                { 1, new(Name.Keyword) },
                { 2, new(Name.EntityNameType) },
            }
        };

        repository["enum-definition"] = new Pattern()
        {
            Match = @$"({DeclarationKeywords.Enum})\s+({identifier})(\s*(:)\s*({typeRegex}))?",
            Captures = new()
            {
                { 1, new(Name.Keyword) },
                { 2, new(Name.EntityNameType) },
                { 4, new(Name.Punctuation) },
                { 5, Match.Includes("#type") },
            },
        };

        repository["using"] = new Pattern()
        {
            Match = @$"\b({DeclarationKeywords.Using})\s+([a-zA-Z0-9_\.]+)",
            Captures = new()
            {
                { 1, new(Name.KeywordControl) },
                { 2, new(Name.String) },
            }
        };

        repository["keyword"] = new Pattern()
        {
            Match = @$"\b({keywords})\b",
            Captures = new()
            {
                { 1, new(Name.Keyword) },
            }
        };

        repository["function-call"] = new Pattern()
        {
            Match = @$"\b({identifier})\b\s*(?=\()",
            Captures = new()
            {
                { 1, new(Name.EntityNameFunction) },
            }
        };

        repository["function-definition"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = @$"({typeRegex})\s+({identifier})\s*(?=\()",
                    Captures = new()
                    {
                        { 1, new() { Patterns = [ new() { Include = "#type" } ] } },
                        { 2, new(Name.EntityNameFunction) },
                    }
                },
                new()
                {
                    Match = @$"({typeRegex})\s+({identifier})\s*(<.*>)\s*(?=\()",
                    Captures = new()
                    {
                        { 1, new() { Patterns = [ new() { Include = "#type" } ] } },
                        { 2, new(Name.EntityNameFunction) },
                        { 3, new() { Patterns = [
                            new()
                            {
                                Match = @$"\b(\w+)\b",
                                Captures = new()
                                {
                                    { 1, new(Name.EntityNameType) }
                                }
                            }
                        ] } },
                    }
                },
            ]
        };

        repository["local-definition"] = new Pattern()
        {
            Match = @$"\b({typeRegex})\s+({identifier})\b",
            Captures = new()
            {
                { 1, new() { Patterns = [ new() { Include = "#type" } ] } },
            }
        };

        repository["field-access"] = new Pattern()
        {
            Match = @$"\.\s*({identifier})\b",
            Captures = new()
            {
                { 1, new(Name.EntityNameVariable) },
            }
        };

        repository["strings"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Begin = "\"",
                    End = "\"",
                    Name = Name.StringQuotedDouble,
                    Patterns =
                    [
                        new() { Include = "#string-escaped-char" }
                    ]
                },
                new()
                {
                    Begin = "'",
                    End = "'",
                    Name = Name.StringQuotedSingle,
                    Patterns =
                    [
                        new() { Include = "#string-escaped-char" }
                    ]
                }
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

        repository["operator"] = new Pattern()
        {
            Match = @$"(<|>|<=|>=|==|!=|!|-|\+|\*|\/|&|\+=|-=|\*=|\/=|&=|\^=|\^|\|=|%|<<|>>|&&|\|\||~|\+\+|--|=)",
            Captures = new()
            {
                { 1, new(Name.KeywordOperator) },
            }
        };

        repository["punctuation"] = new Pattern()
        {
            Match = @$"(;|:|,|\(|\)|\[|\]|=>|\.)",
            Captures = new()
            {
                { 1, new(Name.Punctuation) },
            }
        };

        return new SyntaxFile()
        {
            Schema = "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
            Name = "Vibrissa Language",
            FileTypes = [LanguageConstants.LanguageExtension],
            ScopeName = $"source{LanguageConstants.LanguageExtension}",
            Repository = repository,
            Patterns = [
                new() { Include = "#hover-popup" },
                new() { Include = "#comment" },
                new() { Include = "#comment-block" },
                new() { Include = "#preprocessor" },
                new() { Include = "#using" },
                new() { Include = "#alias-definition" },
                new() { Include = "#enum-definition" },
                new() { Include = "#struct-definition" },
                new() { Include = "#function-definition" },
                new() { Include = "#any-statement" },
                new() { Include = "#scope" },
                new() { Include = "#keyword" },
                new() { Include = "#punctuation" },
                new() { Include = "#operator" },
            ]
        };
    }
}
