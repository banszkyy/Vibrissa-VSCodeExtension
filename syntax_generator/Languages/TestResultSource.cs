using System.Collections.Generic;

namespace LanguageCore.SyntaxGenerator;

static class TestResultSource
{
    public static SyntaxFile Generate()
    {
        Dictionary<string, Pattern> repository = [];

        repository["escaped"] = new Pattern()
        {
            Match = "(\\.)",
            Captures = new()
            {
                { 1, new(Name.ConstantCharacterEscape) },
            }
        };

        repository["hash"] = new Pattern()
        {
            Patterns = [
                new()
                {
                    Match = @"(#exitcode)\s+(-?\d+)\n",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new(Name.ConstantNumeric) },
                    },
                },
                new()
                {
                    Match = @"(#exposed)\s+(\w+)(.*)\n",
                    Captures = new()
                    {
                        { 1, new(Name.Keyword) },
                        { 2, new(Name.StringUnquoted) },
                        { 3,
                        new Match()
                        {
                            Patterns = [
                                new Pattern()
                                {
                                    Match = @"(=>)",
                                    Captures = new()
                                    {
                                        { 1, new(Name.Punctuation) },
                                    },
                                },
                                new Pattern()
                                {
                                    Match = @"(i8|i16|i32)(:)(-?\d+)",
                                    Captures = new()
                                    {
                                        { 1, new(Name.EntityNameType) },
                                        { 2, new(Name.Punctuation) },
                                        { 3, new(Name.ConstantNumeric) },
                                    },
                                },
                                new Pattern()
                                {
                                    Match = @"(f32)(:)(-?(\d+(\.\d+)?))",
                                    Captures = new()
                                    {
                                        { 1, new(Name.EntityNameType) },
                                        { 2, new(Name.Punctuation) },
                                        { 3, new(Name.ConstantNumeric) },
                                    },
                                },
                            ]
                        } },
                    },
                },
                new()
                {
                    Match = "(#.*)\n",
                    Captures = new()
                    {
                        { 1, new(Name.Invalid) },
                    },
                },
            ],
        };

        return new SyntaxFile()
        {
            Schema = "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
            Name = "Vibrissa Test Result Language",
            FileTypes = ["vibrissa-test-result"],
            ScopeName = "source.result",
            Repository = repository,
            Patterns = [
                new() { Include = "#escaped" },
                new() { Include = "#hash" },
            ]
        };
    }
}
