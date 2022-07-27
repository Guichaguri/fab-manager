import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import slugify from 'slugify';
import _ from 'lodash';
import { HtmlTranslate } from '../base/html-translate';
import { Product } from '../../models/product';
import { FormInput } from '../form/form-input';
import { FormSwitch } from '../form/form-switch';
import { FormSelect } from '../form/form-select';
import { FormChecklist } from '../form/form-checklist';
import { FormRichText } from '../form/form-rich-text';
import { FabButton } from '../base/fab-button';
import { FabAlert } from '../base/fab-alert';
import ProductCategoryAPI from '../../api/product-category';
import MachineAPI from '../../api/machine';
import ProductAPI from '../../api/product';

interface ProductFormProps {
  product: Product,
  title: string,
  onSuccess: (product: Product) => void,
  onError: (message: string) => void,
}

/**
 * Option format, expected by react-select
 * @see https://github.com/JedWatson/react-select
 */
type selectOption = { value: number, label: string };

/**
 * Option format, expected by checklist
 */
type checklistOption = { value: number, label: string };

/**
 * Form component to create or update a product
 */
export const ProductForm: React.FC<ProductFormProps> = ({ product, title, onSuccess, onError }) => {
  const { t } = useTranslation('admin');

  const { handleSubmit, register, control, formState, setValue, reset } = useForm<Product>({ defaultValues: { ...product } });
  const [isActivePrice, setIsActivePrice] = useState<boolean>(product.id && _.isFinite(product.amount) && product.amount > 0);
  const [productCategories, setProductCategories] = useState<selectOption[]>([]);
  const [machines, setMachines] = useState<checklistOption[]>([]);

  useEffect(() => {
    ProductCategoryAPI.index().then(data => {
      setProductCategories(buildSelectOptions(data));
    }).catch(onError);
    MachineAPI.index({ disabled: false }).then(data => {
      setMachines(buildChecklistOptions(data));
    }).catch(onError);
  }, []);

  /**
   * Convert the provided array of items to the react-select format
   */
  const buildSelectOptions = (items: Array<{ id?: number, name: string }>): Array<selectOption> => {
    return items.map(t => {
      return { value: t.id, label: t.name };
    });
  };

  /**
   * Convert the provided array of items to the checklist format
   */
  const buildChecklistOptions = (items: Array<{ id?: number, name: string }>): Array<checklistOption> => {
    return items.map(t => {
      return { value: t.id, label: t.name };
    });
  };

  /**
   * Callback triggered when the name has changed.
   */
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const name = event.target.value;
    const slug = slugify(name, { lower: true, strict: true });
    setValue('slug', slug);
  };

  /**
   * Callback triggered when is active price has changed.
   */
  const toggleIsActivePrice = (value: boolean) => {
    if (!value) {
      setValue('amount', null);
    }
    setIsActivePrice(value);
  };

  /**
   * Callback triggered when the form is submitted: process with the product creation or update.
   */
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    return handleSubmit((data: Product) => {
      saveProduct(data);
    })(event);
  };

  /**
   * Call product creation or update api
   */
  const saveProduct = (data: Product) => {
    if (product.id) {
      ProductAPI.update(data).then((res) => {
        reset(res);
        onSuccess(res);
      }).catch(onError);
    } else {
      ProductAPI.create(data).then((res) => {
        reset(res);
        onSuccess(res);
      }).catch(onError);
    }
  };

  return (
    <>
      <h2>{title}</h2>
      <FabButton className="save" onClick={handleSubmit(saveProduct)}>{t('app.admin.store.product_form.save')}</FabButton>
      <form className="product-form" onSubmit={onSubmit}>
        <FormInput id="name"
                   register={register}
                   rules={{ required: true }}
                   formState={formState}
                   onChange={handleNameChange}
                   label={t('app.admin.store.product_form.name')} />
        <FormInput id="sku"
                   register={register}
                   formState={formState}
                   label={t('app.admin.store.product_form.sku')} />
        <FormInput id="slug"
                   register={register}
                   rules={{ required: true }}
                   formState={formState}
                   label={t('app.admin.store.product_form.slug')} />
        <FormSwitch control={control}
                    id="is_active"
                    formState={formState}
                    label={t('app.admin.store.product_form.is_show_in_store')} />
        <div className="price-data">
          <h4>{t('app.admin.store.product_form.price_and_rule_of_selling_product')}</h4>
          <FormSwitch control={control}
                      id="is_active_price"
                      label={t('app.admin.store.product_form.is_active_price')}
                      tooltip={t('app.admin.store.product_form.is_active_price')}
                      defaultValue={isActivePrice}
                      onChange={toggleIsActivePrice} />
          {isActivePrice && <div className="price-fields">
            <FormInput id="amount"
                       type="number"
                       register={register}
                       rules={{ required: true, min: 0.01 }}
                       step={0.01}
                       formState={formState}
                       label={t('app.admin.store.product_form.price')} />
            <FormInput id="quantity_min"
                       type="number"
                       rules={{ required: true }}
                       register={register}
                       formState={formState}
                       label={t('app.admin.store.product_form.quantity_min')} />
          </div>}
          <h4>{t('app.admin.store.product_form.assigning_category')}</h4>
          <FabAlert level="warning">
            <HtmlTranslate trKey="app.admin.store.product_form.assigning_category_info" />
          </FabAlert>
          <FormSelect options={productCategories}
                      control={control}
                      id="product_category_id"
                      formState={formState}
                      label={t('app.admin.store.product_form.linking_product_to_category')} />
          <h4>{t('app.admin.store.product_form.assigning_machines')}</h4>
          <FabAlert level="warning">
            <HtmlTranslate trKey="app.admin.store.product_form.assigning_machines_info" />
          </FabAlert>
          <FormChecklist options={machines}
                         control={control}
                         id="machine_ids"
                         formState={formState} />
          <h4>{t('app.admin.store.product_form.product_description')}</h4>
          <FabAlert level="warning">
            <HtmlTranslate trKey="app.admin.store.product_form.product_description_info" />
          </FabAlert>
          <FormRichText control={control}
                        paragraphTools={true}
                        limit={1000}
                        id="description" />
        </div>
        <div className="main-actions">
          <FabButton type="submit" className="submit-button">{t('app.admin.store.product_form.save')}</FabButton>
        </div>
      </form>
    </>
  );
};
