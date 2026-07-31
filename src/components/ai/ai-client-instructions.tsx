import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ClientIcon, statusVariant } from "@/components/ai/ai-client-icon";
import type { AiClient } from "@/lib/mcp/aiClients";
import { MCP_SERVER_URL } from "@/lib/mcp/config";
import { cn } from "@/lib/utils";

export function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground">
      {steps.map((step) => (
        <li key={step} className="pl-1">
          {step}
        </li>
      ))}
    </ol>
  );
}

export function ClientInstructions({ client }: { client: AiClient }) {
  return (
    <section
      id={`instructions-${client.id}`}
      aria-labelledby={`instructions-title-${client.id}`}
      className="space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ClientIcon icon={client.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-2">
          <h3
            id={`instructions-title-${client.id}`}
            className="text-base font-semibold sm:text-lg"
          >
            {client.panelTitle}
          </h3>
          <Badge
            variant={statusVariant[client.status]}
            className="whitespace-normal"
          >
            {client.panelStatusLabel}
          </Badge>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {client.availability}
      </p>

      {client.instructionsDisplay === "collapsible" ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 w-full justify-between whitespace-normal py-2 text-left motion-reduce:transition-none [&[data-state=open]>svg]:rotate-180"
            >
              {client.instructionsTitle}
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-4 motion-reduce:animate-none">
            {client.instructionsIntro && (
              <p className="text-sm font-medium">{client.instructionsIntro}</p>
            )}
            <NumberedSteps steps={client.instructions} />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        client.instructions.length > 0 && (
          <NumberedSteps steps={client.instructions} />
        )
      )}

      {client.notes.map((note) => (
        <p
          key={note}
          className={cn(
            "rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed",
            client.status === "tested" && "border-primary/30 bg-primary/5",
          )}
        >
          {note}
        </p>
      ))}
    </section>
  );
}

export function AdvancedClient({ client }: { client: AiClient }) {
  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "gastinho-simples": {
          url: MCP_SERVER_URL,
        },
      },
    },
    null,
    2,
  );

  return (
    <article className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <ClientIcon
          icon={client.icon}
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
        />
        <div className="min-w-0">
          <h3 className="font-semibold">{client.name}</h3>
          <Badge variant="secondary" className="mt-1">
            {client.statusLabel}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{client.availability}</p>
      <NumberedSteps steps={client.instructions} />
      {client.example === "mcp-server-json" && (
        <pre className="max-w-full whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-xs text-foreground">
          <code>{cursorConfig}</code>
        </pre>
      )}
      {client.notes.map((note) => (
        <p key={note} className="text-sm font-medium">
          {note}
        </p>
      ))}
    </article>
  );
}
