import { AgentDoc } from "@/types/arena";

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
});

const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "—";
    }
    return currencyFormatter.format(value);
};

export function NottePanel({ agent }: { agent: AgentDoc }) {
    const result = (agent.result as Record<string, any>) ?? {};
    const usage = (result.usage as Record<string, any>) ?? {};
    const steps = Array.isArray(result.steps) ? result.steps : [];
    const success = typeof result.success === "boolean" ? result.success : undefined;
    const answer = typeof result.answer === "string" ? result.answer : null;
    const duration = typeof result.duration === "number" ? result.duration : null;
    const credits = typeof usage.credits === "number" ? usage.credits : usage.total_cost;

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Outcome
                    </p>
                    <p className="text-base font-medium mt-1">
                        {success === undefined ? "In progress" : success ? "Success" : "Failed"}
                    </p>
                </div>
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Credits
                    </p>
                    <p className="text-base font-medium mt-1">
                        {credits !== undefined ? formatCurrency(credits) : "—"}
                    </p>
                </div>
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Steps
                    </p>
                    <p className="text-base font-medium mt-1">
                        {steps.length}
                    </p>
                </div>
            </div>

            {duration !== null && (
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Duration
                    </p>
                    <p className="text-base font-medium mt-1">
                        {duration.toFixed(1)}s
                    </p>
                </div>
            )}

            {answer && (
                <div className="bg-card rounded-lg border p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Final Answer
                    </h4>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
                </div>
            )}

            {steps.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Steps ({steps.length})
                    </h4>
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                        {steps.map((step, index) => {
                            const stepObj = typeof step === "object" && step !== null ? step as Record<string, any> : {};
                            const title = stepObj.title || stepObj.action || stepObj.goal || `Step ${index + 1}`;
                            const description = stepObj.thought || stepObj.description || stepObj.observation || stepObj.result;

                            return (
                                <div key={index} className="border rounded-lg p-3 bg-muted/30">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-foreground">
                                            {title || `Step ${index + 1}`}
                                        </p>
                                        {typeof stepObj.success === "boolean" && (
                                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${stepObj.success ? "text-green-600" : "text-red-500"}`}>
                                                {stepObj.success ? "Success" : "Failed"}
                                            </span>
                                        )}
                                    </div>
                                    {description && (
                                        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                                            {description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-card rounded-lg border p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Raw Output
                </h4>
                <pre className="text-xs bg-muted/60 p-3 rounded max-h-[260px] overflow-y-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
        </div>
    );
}


