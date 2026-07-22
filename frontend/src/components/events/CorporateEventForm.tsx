import type { FormEvent } from 'react';
import type { Area } from '../../api/areas.types';

export interface CorporateEventFormValues {
  title: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  isCompanyWide: boolean;
  areaIds: number[];
}

interface Props {
  areas: Area[];
  initialValues?: Partial<CorporateEventFormValues>;
  loading?: boolean;
  submitLabel?: string;
  publishLabel?: string;
  onSubmit: (values: CorporateEventFormValues) => void | Promise<void>;
  onPublish?: (values: CorporateEventFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function CorporateEventForm({
  areas,
  initialValues,
  loading = false,
  submitLabel = 'Guardar borrador',
  publishLabel = 'Guardar y publicar',
  onSubmit,
  onPublish,
  onCancel,
}: Props) {
  const readValues = (form: HTMLFormElement): CorporateEventFormValues => {
    const data = new FormData(form);
    const isCompanyWide = data.get('isCompanyWide') === 'on';
    const areaIds = isCompanyWide
      ? []
      : areas.filter((a) => data.get(`area-${a.id}`) === 'on').map((a) => a.id);

    return {
      title: String(data.get('title') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
      location: String(data.get('location') ?? '').trim(),
      startDateTime: String(data.get('startDateTime') ?? ''),
      endDateTime: String(data.get('endDateTime') ?? ''),
      isCompanyWide,
      areaIds,
    };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(readValues(event.currentTarget));
  };

  const toggleArea = (areaId: number, checked: boolean, form: HTMLFormElement) => {
    const input = form.elements.namedItem(`area-${areaId}`) as HTMLInputElement | null;
    if (input) input.checked = checked;
  };

  return (
    <form className="card-style mb-30 events-form" onSubmit={handleSubmit}>
      <div className="row">
        <div className="col-lg-8">
          <div className="input-style-1 mb-20">
            <label htmlFor="event-title">Título *</label>
            <input
              id="event-title"
              name="title"
              type="text"
              required
              maxLength={255}
              defaultValue={initialValues?.title ?? ''}
              disabled={loading}
            />
          </div>

          <div className="input-style-1 mb-20">
            <label htmlFor="event-description">Descripción</label>
            <textarea
              id="event-description"
              name="description"
              rows={5}
              defaultValue={initialValues?.description ?? ''}
              disabled={loading}
            />
          </div>

          <div className="input-style-1 mb-20">
            <label htmlFor="event-location">Ubicación</label>
            <input
              id="event-location"
              name="location"
              type="text"
              maxLength={300}
              defaultValue={initialValues?.location ?? ''}
              disabled={loading}
            />
          </div>

          <div className="row">
            <div className="col-md-6">
              <div className="input-style-1 mb-20">
                <label htmlFor="event-start">Inicio *</label>
                <input
                  id="event-start"
                  name="startDateTime"
                  type="datetime-local"
                  required
                  defaultValue={initialValues?.startDateTime ?? ''}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="input-style-1 mb-20">
                <label htmlFor="event-end">Fin *</label>
                <input
                  id="event-end"
                  name="endDateTime"
                  type="datetime-local"
                  required
                  defaultValue={initialValues?.endDateTime ?? ''}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <fieldset className="events-form__audience mb-20">
            <legend className="text-medium mb-15">Audiencia</legend>

            <label className="events-form__checkbox mb-15">
              <input
                type="checkbox"
                name="isCompanyWide"
                defaultChecked={initialValues?.isCompanyWide ?? false}
                disabled={loading}
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  if (!form) return;
                  if (e.currentTarget.checked) {
                    for (const area of areas) {
                      toggleArea(area.id, false, form);
                    }
                  }
                }}
              />
              <span>Toda la empresa</span>
            </label>

            <p className="text-sm text-gray mb-10">O seleccione áreas específicas:</p>
            <div className="events-form__areas">
              {areas.map((area) => (
                <label key={area.id} className="events-form__checkbox">
                  <input
                    type="checkbox"
                    name={`area-${area.id}`}
                    defaultChecked={initialValues?.areaIds?.includes(area.id) ?? false}
                    disabled={loading}
                    onChange={(e) => {
                      const form = e.currentTarget.form;
                      if (!form) return;
                      if (e.currentTarget.checked) {
                        const companyWide = form.elements.namedItem(
                          'isCompanyWide',
                        ) as HTMLInputElement;
                        if (companyWide) companyWide.checked = false;
                      }
                    }}
                  />
                  <span>{area.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="events-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
        {onPublish ? (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={loading}
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (!form?.reportValidity()) return;
              void onPublish(readValues(form));
            }}
          >
            {loading ? 'Guardando…' : publishLabel}
          </button>
        ) : null}
        <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
          {loading ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
