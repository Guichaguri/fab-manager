/**
 * This component shows a list of all payment schedules with their associated deadlines (aka. PaymentScheduleItem) and invoices
 */

import React, { useState } from 'react';
import { IApplication } from '../models/application';
import { useTranslation } from 'react-i18next';
import { Loader } from './loader';
import { react2angular } from 'react2angular';
import PaymentScheduleAPI from '../api/payment-schedule';
import { DocumentFilters } from './document-filters';
import { PaymentSchedulesTable } from './payment-schedules-table';
import { FabButton } from './fab-button';

declare var Application: IApplication;

const PAGE_SIZE = 20;
const paymentSchedulesList = PaymentScheduleAPI.list({ query: { page: 1, size: 20 } });

const PaymentSchedulesList: React.FC = () => {
  const { t } = useTranslation('admin');

  const [paymentSchedules, setPaymentSchedules] = useState(paymentSchedulesList.read());
  const [pageNumber, setPageNumber] = useState(1);
  const [referenceFilter, setReferenceFilter] = useState(null);
  const [customerFilter, setCustomerFilter] = useState(null);
  const [dateFilter, setDateFilter] = useState(null);

  /**
   * Fetch from the API the payments schedules matching the given filters and reset the results table with the new schedules.
   */
  const handleFiltersChange = ({ reference, customer, date }): void => {
    setReferenceFilter(reference);
    setCustomerFilter(customer);
    setDateFilter(date);

    const api = new PaymentScheduleAPI();
    api.list({ query: { reference, customer, date, page: 1, size: PAGE_SIZE }}).then((res) => {
      setPaymentSchedules(res);
    });
  };

  /**
   * Fetch from the API the next payment schedules to display, for the current filters, and append them to the current results table.
   */
  const handleLoadMore = (): void => {
    setPageNumber(pageNumber + 1);

    const api = new PaymentScheduleAPI();
    api.list({ query: { reference: referenceFilter, customer: customerFilter, date: dateFilter, page: pageNumber + 1, size: PAGE_SIZE }}).then((res) => {
      const list = paymentSchedules.concat(res);
      setPaymentSchedules(list);
    });
  }

  /**
   * Check if the current collection of payment schedules is empty or not.
   */
  const hasSchedules = (): boolean => {
    return paymentSchedules.length > 0;
  }

  /**
   * Check if there are some results for the current filters that aren't currently shown.
   */
  const hasMoreSchedules = (): boolean => {
    return hasSchedules() && paymentSchedules.length < paymentSchedules[0].max_length;
  }

  return (
    <div className="payment-schedules-list">
      <h3>
        <i className="fas fa-filter" />
        {t('app.admin.invoices.payment_schedules.filter_schedules')}
      </h3>
      <div className="schedules-filters">
        <DocumentFilters onFilterChange={handleFiltersChange} />
      </div>
      {!hasSchedules() && <div>{t('app.admin.invoices.payment_schedules.no_payment_schedules')}</div>}
      {hasSchedules() && <div className="schedules-list">
        <PaymentSchedulesTable paymentSchedules={paymentSchedules} showCustomer={true} />
        {hasMoreSchedules() && <FabButton className="load-more" onClick={handleLoadMore}>{t('app.admin.invoices.payment_schedules.load_more')}</FabButton>}
      </div>}
    </div>
  );
}


const PaymentSchedulesListWrapper: React.FC = () => {
  return (
    <Loader>
      <PaymentSchedulesList />
    </Loader>
  );
}

Application.Components.component('paymentSchedulesList', react2angular(PaymentSchedulesListWrapper));
