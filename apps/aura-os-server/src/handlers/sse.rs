use std::convert::Infallible;

use axum::response::sse::Event;

use aura_os_link::AutomatonEvent;

/// Maps an [`AutomatonEvent`] from the swarm to an SSE [`Event`].
pub(crate) fn automaton_event_to_sse(evt: &AutomatonEvent) -> Result<Event, Infallible> {
    Ok(Event::default()
        .event(&evt.event_type)
        .json_data(&evt.data)
        .unwrap_or_else(|_| Event::default().data("{}")))
}
